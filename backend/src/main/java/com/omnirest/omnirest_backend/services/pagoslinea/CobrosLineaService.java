package com.omnirest.omnirest_backend.services.pagoslinea;

import com.omnirest.omnirest_backend.domain.entities.Order;
import com.omnirest.omnirest_backend.domain.entities.Pago;
import com.omnirest.omnirest_backend.domain.entities.PagosLineaConfig;
import com.omnirest.omnirest_backend.domain.entities.PagosLineaConfig.EstadoCuenta;
import com.omnirest.omnirest_backend.domain.entities.TransaccionLinea;
import com.omnirest.omnirest_backend.domain.entities.TransaccionLinea.Estado;
import com.omnirest.omnirest_backend.dtos.PagoEnLineaDTO;
import com.omnirest.omnirest_backend.repositories.OrderRepository;
import com.omnirest.omnirest_backend.repositories.PagoRepository;
import com.omnirest.omnirest_backend.repositories.PagosLineaConfigRepository;
import com.omnirest.omnirest_backend.repositories.TransaccionLineaRepository;
import com.stripe.exception.StripeException;
import com.stripe.model.BalanceTransaction;
import com.stripe.model.Charge;
import com.stripe.model.PaymentIntent;
import com.stripe.model.StripeError;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.EnumSet;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Los cobros con tarjeta del menu en linea, en la cuenta de Stripe de cada
 * restaurante (cargo directo).
 *
 * El pedido nace esperando el pago y no lo ve nadie. Solo cuando Stripe dice
 * que se pago (por su aviso o al preguntarle) se marca pagado y aparece en el
 * mostrador; que el navegador diga "listo" no cuenta. Si no se paga en 20
 * minutos, el cobro se cancela y el pedido tambien.
 */
@Service
@Slf4j
public class CobrosLineaService {

    static final int MINUTOS_PARA_PAGAR = 20;
    /** Lo minimo que Stripe cobra en pesos. */
    static final BigDecimal MINIMO = new BigDecimal("10.00");
    /** Cada cuanto se le pregunta a Stripe por un pago pendiente cuando el cliente consulta. */
    private static final int SEGUNDOS_ENTRE_CONSULTAS = 4;

    private static final Set<Estado> TERMINADOS =
            EnumSet.of(Estado.PAGADO, Estado.CANCELADO, Estado.REEMBOLSADO, Estado.REEMBOLSO_PARCIAL);
    private static final Set<Estado> ABIERTOS = EnumSet.of(Estado.PENDIENTE, Estado.PROCESANDO, Estado.FALLIDO);

    private final TransaccionLineaRepository transacciones;
    private final PagosLineaConfigRepository configuraciones;
    private final OrderRepository pedidos;
    private final PagoRepository pagos;
    private final StripeConnect stripe;
    private final ApplicationEventPublisher eventos;
    private final TransactionTemplate enTransaccion;

    @jakarta.persistence.PersistenceContext
    private jakarta.persistence.EntityManager em;

    public CobrosLineaService(TransaccionLineaRepository transacciones, PagosLineaConfigRepository configuraciones,
                              OrderRepository pedidos, PagoRepository pagos, StripeConnect stripe,
                              ApplicationEventPublisher eventos, PlatformTransactionManager transacciones2) {
        this.transacciones = transacciones;
        this.configuraciones = configuraciones;
        this.pedidos = pedidos;
        this.pagos = pagos;
        this.stripe = stripe;
        this.eventos = eventos;
        this.enTransaccion = new TransactionTemplate(transacciones2);
    }

    /** Como puede pagar el cliente en el menu en linea de este restaurante. */
    public record Formas(boolean tarjeta, boolean efectivo, boolean enTienda) {
    }

    /** Lo que ve el cliente mientras espera: el estado del pago y, si fallo, por que. */
    public record EstadoPago(Estado estado, String mensaje, String marca, String ultimos4) {
    }

    // ------------------------------------------------------------------
    // Formas de pago del menu
    // ------------------------------------------------------------------

    public Formas formas(UUID restaurantId) {
        PagosLineaConfig c = configuraciones.findById(restaurantId).orElse(null);
        boolean tarjeta = tarjetaDisponible(c);
        boolean efectivo = c == null || Boolean.TRUE.equals(c.getAceptaEfectivo()) || !tarjeta;
        boolean tienda = c == null || Boolean.TRUE.equals(c.getAceptaEnTienda()) || !tarjeta;
        // Sin tarjeta disponible nunca se queda el cliente sin como pagar: al recibir, como siempre.
        return new Formas(tarjeta, efectivo, tienda);
    }

    /**
     * Revisa que la forma elegida este abierta. {@code paraRecoger}: en tienda
     * en vez de efectivo al recibir.
     *
     * @return true si es con tarjeta en linea
     */
    public boolean exigirForma(UUID restaurantId, String forma, boolean paraRecoger) {
        Formas f = formas(restaurantId);
        if ("TARJETA".equalsIgnoreCase(forma)) {
            if (!f.tarjeta()) {
                throw new IllegalStateException("El pago con tarjeta no está disponible ahora. Elige otra forma de pago.");
            }
            return true;
        }
        if (paraRecoger ? !f.enTienda() : !f.efectivo()) {
            throw new IllegalStateException("Este restaurante solo recibe pago con tarjeta en línea.");
        }
        return false;
    }

    private boolean tarjetaDisponible(PagosLineaConfig c) {
        return c != null && Boolean.TRUE.equals(c.getActivo()) && Boolean.TRUE.equals(c.getAceptaTarjeta())
                && c.getEstadoCuenta() == EstadoCuenta.LISTA && c.getStripeAccountId() != null
                && stripe.configurado() && stripe.llavePublica() != null;
    }

    // ------------------------------------------------------------------
    // Iniciar el cobro
    // ------------------------------------------------------------------

    /**
     * Crea el cobro del pedido en la cuenta del restaurante. Si Stripe falla, la
     * excepcion deshace tambien el pedido: no queda uno sin forma de pagarse.
     *
     * @param monto    lo que paga el cliente, propina y envio incluidos
     * @param telefono para encontrar el pago despues; se guarda enmascarado
     */
    public PagoEnLineaDTO iniciar(Order order, BigDecimal monto, BigDecimal propina, String telefono) {
        UUID restaurantId = order.getBranch().getRestaurant().getId();
        PagosLineaConfig c = configuraciones.findById(restaurantId).filter(this::tarjetaDisponible)
                .orElseThrow(() -> new IllegalStateException(
                        "El pago con tarjeta no está disponible ahora. Elige otra forma de pago."));
        BigDecimal total = monto.setScale(2, RoundingMode.HALF_UP);
        if (total.compareTo(MINIMO) < 0) {
            throw new IllegalArgumentException("El pago con tarjeta es desde $" + MINIMO.toPlainString() + ".");
        }
        BigDecimal comision = comision(total, c.getComisionPlataformaPct());

        String codigo = order.getTurno() != null ? order.getTurno() : order.getTokenSeguimiento();
        Map<String, String> metadata = new LinkedHashMap<>();
        metadata.put("order_id", order.getId().toString());
        metadata.put("branch_id", order.getBranch().getId().toString());
        metadata.put("restaurant_id", restaurantId.toString());
        metadata.put("pedido", String.valueOf(codigo));

        String clave = "pedido-" + order.getId();
        PaymentIntent pi;
        try {
            pi = stripe.crearCobro(c.getStripeAccountId(), centavos(total), centavos(comision),
                    "Pedido " + codigo + " · " + order.getBranch().getName(), metadata, clave);
        } catch (StripeException e) {
            log.error("Stripe: no se pudo crear el cobro del pedido {}: {}", order.getId(), e.getMessage());
            throw new IllegalStateException(
                    "No se pudo iniciar el pago con tarjeta. Intenta de nuevo o elige otra forma de pago.");
        }

        LocalDateTime expira = LocalDateTime.now().plusMinutes(MINUTOS_PARA_PAGAR);
        TransaccionLinea t = transacciones.save(TransaccionLinea.builder()
                .restaurantId(restaurantId)
                .branchId(order.getBranch().getId())
                .orderId(order.getId())
                .stripeAccountId(c.getStripeAccountId())
                .paymentIntentId(pi.getId())
                .claveIdempotencia(clave)
                .monto(total)
                .propina(propina != null ? propina.setScale(2, RoundingMode.HALF_UP) : BigDecimal.ZERO)
                .comisionPlataforma(comision)
                .clienteRef(enmascarar(telefono))
                .expiraEn(expira)
                .build());
        log.info("Cobro en linea {} del pedido {}: ${} (comision Pide Facil ${})", pi.getId(), codigo, total, comision);
        return new PagoEnLineaDTO(t.getId(), pi.getClientSecret(), stripe.llavePublica(), c.getStripeAccountId(),
                total, expira);
    }

    static BigDecimal comision(BigDecimal total, BigDecimal pct) {
        if (pct == null || pct.signum() <= 0) return BigDecimal.ZERO.setScale(2);
        return total.multiply(pct).divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);
    }

    static long centavos(BigDecimal pesos) {
        return pesos.movePointRight(2).setScale(0, RoundingMode.HALF_UP).longValueExact();
    }

    // ------------------------------------------------------------------
    // Lo que dice Stripe
    // ------------------------------------------------------------------

    /**
     * Para la pantalla del cliente. Si el pago sigue abierto se le pregunta a
     * Stripe (cada pocos segundos): asi no depende solo del aviso.
     */
    @Transactional
    public EstadoPago estado(UUID transaccionId) {
        TransaccionLinea t = transacciones.findById(transaccionId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Pago no encontrado."));
        if (ABIERTOS.contains(t.getEstado())
                && t.getActualizadoEn().isBefore(LocalDateTime.now().minusSeconds(SEGUNDOS_ENTRE_CONSULTAS))) {
            try {
                PaymentIntent pi = stripe.cobro(t.getStripeAccountId(), t.getPaymentIntentId());
                bloquear(t);
                aplicar(t, pi);
            } catch (StripeException e) {
                log.warn("Stripe: no se pudo consultar el cobro {}: {}", t.getPaymentIntentId(), e.getMessage());
            }
        }
        return new EstadoPago(t.getEstado(), mensaje(t), t.getMarcaTarjeta(), t.getUltimos4());
    }

    /** Stripe aviso de un cobro (webhook). Se vuelve a leer: los avisos llegan fuera de orden. */
    @Transactional
    public void alAvisoDeStripe(String cuenta, String paymentIntentId) throws StripeException {
        TransaccionLinea t = transacciones.findByPaymentIntentId(paymentIntentId).orElse(null);
        if (t == null) {
            log.info("Stripe: aviso del cobro {} que no es de un pedido", paymentIntentId);
            return;
        }
        if (!t.getStripeAccountId().equals(cuenta)) {
            log.warn("Stripe: aviso del cobro {} desde la cuenta {}, pero es de {}", paymentIntentId, cuenta,
                    t.getStripeAccountId());
            return;
        }
        PaymentIntent pi = stripe.cobro(cuenta, paymentIntentId);
        bloquear(t);
        aplicar(t, pi);
    }

    /** Pone la transaccion (y el pedido) como dice Stripe. Se puede llamar varias veces. */
    void aplicar(TransaccionLinea t, PaymentIntent pi) {
        switch (pi.getStatus()) {
            case "succeeded" -> pagado(t, pi);
            case "processing" -> {
                if (!TERMINADOS.contains(t.getEstado())) t.setEstado(Estado.PROCESANDO);
            }
            case "canceled" -> cancelado(t, "El pago se canceló.");
            case "requires_payment_method" -> {
                if (!TERMINADOS.contains(t.getEstado()) && pi.getLastPaymentError() != null) {
                    t.setEstado(Estado.FALLIDO);
                    t.setError(rechazo(pi.getLastPaymentError()));
                }
            }
            default -> {
                // requires_action (verificacion del banco), requires_confirmation: sigue pendiente.
            }
        }
        t.setActualizadoEn(LocalDateTime.now());
        transacciones.save(t);
    }

    private void pagado(TransaccionLinea t, PaymentIntent pi) {
        if (t.getEstado() == Estado.PAGADO || t.getEstado() == Estado.REEMBOLSADO
                || t.getEstado() == Estado.REEMBOLSO_PARCIAL) {
            return; // Ya se registro.
        }
        if (t.getEstado() == Estado.CANCELADO) {
            // Se cobro despues de darlo por vencido: hay que devolverlo desde el panel.
            log.error("Stripe: el cobro {} se pago pero su pedido {} ya estaba cancelado", pi.getId(), t.getOrderId());
        }
        t.setEstado(Estado.PAGADO);
        t.setError(null);
        t.setPagadoEn(LocalDateTime.now());
        Charge cargo = pi.getLatestChargeObject();
        if (cargo != null) {
            if (cargo.getPaymentMethodDetails() != null && cargo.getPaymentMethodDetails().getCard() != null) {
                t.setMarcaTarjeta(cargo.getPaymentMethodDetails().getCard().getBrand());
                t.setUltimos4(cargo.getPaymentMethodDetails().getCard().getLast4());
            }
            BalanceTransaction bt = cargo.getBalanceTransactionObject();
            if (bt != null && bt.getFeeDetails() != null) {
                long fee = bt.getFeeDetails().stream().filter(d -> "stripe_fee".equals(d.getType()))
                        .mapToLong(d -> d.getAmount() != null ? d.getAmount() : 0).sum();
                t.setComisionStripe(BigDecimal.valueOf(fee).movePointLeft(2));
            }
        }

        Order order = pedidos.findById(t.getOrderId()).orElse(null);
        if (order == null) return;
        boolean cancelado = order.getStatus() == com.omnirest.omnirest_backend.domain.enums.OrderStatus.CANCELLED;
        if (!cancelado) {
            order.setEsperandoPagoLinea(false);
            order.setPagadoEnLinea(true);
            pedidos.save(order);
        }
        BigDecimal propina = t.getPropina() != null ? t.getPropina() : BigDecimal.ZERO;
        pagos.save(Pago.builder()
                .orderId(order.getId())
                .turnoId(null) // No entra al cajon: no es de ningun turno.
                .transaccionLineaId(t.getId())
                .metodo("Tarjeta en línea")
                .esEfectivo(false)
                .monto(t.getMonto().subtract(propina))
                .propina(propina)
                .cobradoPor("Stripe")
                .build());
        log.info("Pedido {} pagado en linea ({} ••{}): ${}", order.getId(), t.getMarcaTarjeta(), t.getUltimos4(), t.getMonto());
        if (!cancelado) {
            eventos.publishEvent(new PagoLineaResuelto(order.getId(), t.getBranchId(), true));
        }
    }

    private void cancelado(TransaccionLinea t, String motivo) {
        if (TERMINADOS.contains(t.getEstado())) return;
        t.setEstado(Estado.CANCELADO);
        t.setError(motivo);
        eventos.publishEvent(new PagoLineaResuelto(t.getOrderId(), t.getBranchId(), false));
    }

    // ------------------------------------------------------------------
    // Los que no se pagaron a tiempo
    // ------------------------------------------------------------------

    /** Cada minuto: lo que paso de 20 minutos sin pagarse se cancela, en Stripe y aqui. */
    @Scheduled(fixedDelay = 60_000, initialDelay = 45_000)
    public void vencer() {
        for (TransaccionLinea t : transacciones.findTop50ByEstadoInAndExpiraEnBeforeOrderByExpiraEnAsc(
                ABIERTOS, LocalDateTime.now())) {
            try {
                enTransaccion.executeWithoutResult(s -> vencerUna(t.getId()));
            } catch (Exception e) {
                log.warn("Stripe: no se pudo vencer el cobro {}: {}", t.getPaymentIntentId(), e.getMessage());
            }
        }
    }

    /**
     * Bloquea la transaccion y la vuelve a leer de la base: el aviso de Stripe,
     * la consulta del cliente y el vencimiento pueden llegar a la vez, y el
     * segundo debe ver lo que dejo el primero (si no, registraria el pago doble).
     */
    private void bloquear(TransaccionLinea t) {
        if (em != null) em.refresh(t, jakarta.persistence.LockModeType.PESSIMISTIC_WRITE);
    }

    private void vencerUna(UUID id) {
        TransaccionLinea t = transacciones.bloquear(id).orElse(null);
        if (t == null || !ABIERTOS.contains(t.getEstado())) return;
        try {
            PaymentIntent pi = stripe.cobro(t.getStripeAccountId(), t.getPaymentIntentId());
            switch (pi.getStatus()) {
                case "succeeded", "canceled" -> aplicar(t, pi); // Se pago (o cancelo) justo a tiempo.
                case "processing" -> log.info("Stripe: el cobro {} sigue en proceso al vencer", pi.getId());
                default -> {
                    stripe.cancelarCobro(t.getStripeAccountId(), t.getPaymentIntentId());
                    cancelado(t, "No se pagó en " + MINUTOS_PARA_PAGAR + " minutos.");
                    t.setActualizadoEn(LocalDateTime.now());
                    transacciones.save(t);
                    log.info("Cobro {} vencido: el pedido {} se cancela", pi.getId(), t.getOrderId());
                }
            }
        } catch (StripeException e) {
            throw new IllegalStateException(e.getMessage(), e);
        }
    }

    // ------------------------------------------------------------------
    // Apoyos
    // ------------------------------------------------------------------

    private static String mensaje(TransaccionLinea t) {
        return switch (t.getEstado()) {
            case PAGADO -> "Pago recibido.";
            case PROCESANDO -> "Tu banco está procesando el pago. Te avisamos en cuanto se confirme.";
            case FALLIDO -> t.getError() != null ? t.getError() : "La tarjeta fue rechazada.";
            case CANCELADO -> t.getError() != null ? t.getError() : "El pago se canceló.";
            case REEMBOLSADO, REEMBOLSO_PARCIAL -> "El pago se devolvió.";
            default -> "Esperando el pago.";
        };
    }

    /** El rechazo del banco en palabras del cliente. */
    static String rechazo(StripeError e) {
        String codigo = e.getDeclineCode() != null ? e.getDeclineCode() : e.getCode();
        if (codigo == null) return "La tarjeta fue rechazada. Prueba con otra.";
        return switch (codigo) {
            case "insufficient_funds" -> "La tarjeta no tiene fondos suficientes. Prueba con otra.";
            case "expired_card" -> "La tarjeta está vencida.";
            case "incorrect_cvc", "invalid_cvc" -> "El código de seguridad (CVC) no es correcto.";
            case "incorrect_number", "invalid_number" -> "El número de tarjeta no es correcto.";
            case "lost_card", "stolen_card", "fraudulent", "pickup_card" -> "El banco rechazó la tarjeta. Prueba con otra.";
            case "authentication_required", "payment_intent_authentication_failure" ->
                    "No se completó la verificación del banco. Intenta de nuevo.";
            case "processing_error" -> "Hubo un error al procesar la tarjeta. Intenta de nuevo.";
            default -> "La tarjeta fue rechazada. Prueba con otra.";
        };
    }

    /** 5512345678 → ••••5678 */
    static String enmascarar(String telefono) {
        if (telefono == null) return null;
        String digitos = telefono.replaceAll("\\D", "");
        return digitos.length() < 4 ? null : "••••" + digitos.substring(digitos.length() - 4);
    }
}
