package com.omnirest.omnirest_backend.services.pagoslinea;

import com.omnirest.omnirest_backend.domain.entities.Branch;
import com.omnirest.omnirest_backend.domain.entities.Order;
import com.omnirest.omnirest_backend.domain.entities.ReembolsoLinea;
import com.omnirest.omnirest_backend.domain.entities.TransaccionLinea;
import com.omnirest.omnirest_backend.domain.entities.TransaccionLinea.Estado;
import com.omnirest.omnirest_backend.repositories.BranchRepository;
import com.omnirest.omnirest_backend.repositories.OrderRepository;
import com.omnirest.omnirest_backend.repositories.ReembolsoLineaRepository;
import com.omnirest.omnirest_backend.repositories.TransaccionLineaRepository;
import com.omnirest.omnirest_backend.security.CustomUserDetails;
import com.omnirest.omnirest_backend.services.pagoslinea.BitacoraPagosLinea.Accion;
import com.stripe.exception.StripeException;
import com.stripe.model.Refund;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import jakarta.persistence.PersistenceContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.EnumSet;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * La pantalla "Cobros en línea": la lista de pagos con tarjeta del menu, su
 * detalle y los reembolsos. Consultan el dueño, el gerente y quien opera la
 * caja; reembolsar solo el dueño y el gerente.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class TransaccionesLineaService {

    private static final Set<String> REEMBOLSAN = Set.of("SUPER_ADMIN", "ADMIN", "BRANCH_MANAGER");
    private static final Set<Estado> COBRADOS = EnumSet.of(Estado.PAGADO, Estado.REEMBOLSADO, Estado.REEMBOLSO_PARCIAL);

    private final TransaccionLineaRepository transacciones;
    private final ReembolsoLineaRepository reembolsos;
    private final OrderRepository pedidos;
    private final BranchRepository sucursales;
    private final StripeConnect stripe;
    private final BitacoraPagosLinea bitacora;

    @PersistenceContext
    private EntityManager em;

    public record Fila(
            UUID id,
            LocalDateTime creadoEn,
            LocalDateTime pagadoEn,
            String sucursal,
            UUID orderId,
            /** El turno o el codigo con que el cliente conoce su pedido. */
            String pedido,
            Estado estado,
            BigDecimal monto,
            BigDecimal propina,
            BigDecimal montoReembolsado,
            BigDecimal comisionStripe,
            BigDecimal comisionPlataforma,
            /** Lo que le queda al restaurante: cobrado menos comisiones y devoluciones. */
            BigDecimal neto,
            String marca,
            String ultimos4,
            String cliente,
            String error) {
    }

    public record Reembolso(UUID id, BigDecimal monto, String motivo, ReembolsoLinea.Estado estado, String hechoPor,
                            LocalDateTime creadoEn) {
    }

    public record Detalle(Fila cobro, String paymentIntentId, BigDecimal reembolsable, List<Reembolso> reembolsos,
                          boolean puedeReembolsar) {
    }

    public record PedirReembolso(BigDecimal monto, String motivo) {
    }

    // ------------------------------------------------------------------
    // Consultar
    // ------------------------------------------------------------------

    /**
     * @param todos tambien los que no se pagaron (pendientes, rechazados, vencidos)
     */
    @Transactional(readOnly = true)
    public List<Fila> listar(CustomUserDetails u, UUID branchId, LocalDate desde, LocalDate hasta, boolean todos) {
        UUID restaurantId = exigirConsulta(u);
        LocalDate fin = hasta != null ? hasta : LocalDate.now();
        LocalDate inicio = desde != null ? desde : fin.minusDays(30);
        List<TransaccionLinea> lista = transacciones.buscar(restaurantId, inicio.atStartOfDay(),
                fin.plusDays(1).atStartOfDay(), todos ? EnumSet.allOf(Estado.class) : COBRADOS, PageRequest.of(0, 500));
        if (branchId != null) {
            lista = lista.stream().filter(t -> branchId.equals(t.getBranchId())).toList();
        }
        return filas(lista);
    }

    @Transactional(readOnly = true)
    public Detalle detalle(CustomUserDetails u, UUID id) {
        TransaccionLinea t = propia(exigirConsulta(u), id);
        return detalleDe(u, t);
    }

    // ------------------------------------------------------------------
    // Reembolsar
    // ------------------------------------------------------------------

    /** Devuelve todo o una parte del pago. {@code monto} vacio = todo lo que queda. */
    @Transactional
    public Detalle reembolsar(CustomUserDetails u, UUID id, PedirReembolso peticion) {
        UUID restaurantId = exigirReembolso(u);
        TransaccionLinea t = propia(restaurantId, id);
        em.refresh(t, LockModeType.PESSIMISTIC_WRITE); // Dos clics no devuelven dos veces.
        hacerReembolso(t, peticion.monto(), peticion.motivo(), u.username());
        return detalleDe(u, t);
    }

    /** Desde el tablero: al cancelar un pedido pagado, devolver todo. */
    @Transactional
    public Detalle reembolsarPedido(CustomUserDetails u, UUID orderId, String motivo) {
        UUID restaurantId = exigirReembolso(u);
        TransaccionLinea t = transacciones.findByOrderIdOrderByCreadoEnDesc(orderId).stream()
                .filter(x -> restaurantId.equals(x.getRestaurantId()))
                .filter(x -> x.getEstado() == Estado.PAGADO || x.getEstado() == Estado.REEMBOLSO_PARCIAL)
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Este pedido no tiene un pago con tarjeta por devolver."));
        em.refresh(t, LockModeType.PESSIMISTIC_WRITE);
        hacerReembolso(t, null, motivo, u.username());
        return detalleDe(u, t);
    }

    private void hacerReembolso(TransaccionLinea t, BigDecimal pedido, String motivo, String usuario) {
        if (t.getEstado() != Estado.PAGADO && t.getEstado() != Estado.REEMBOLSO_PARCIAL) {
            throw new IllegalStateException("Solo se puede devolver un pago cobrado.");
        }
        BigDecimal queda = reembolsable(t);
        BigDecimal monto = pedido != null ? pedido.setScale(2, RoundingMode.HALF_UP) : queda;
        if (monto.signum() <= 0) {
            throw new IllegalArgumentException("Escribe cuánto vas a devolver.");
        }
        if (monto.compareTo(queda) > 0) {
            throw new IllegalArgumentException("Solo quedan $" + queda.toPlainString() + " por devolver de este pago.");
        }
        String razon = motivo != null && !motivo.isBlank() ? motivo.trim() : null;
        if (razon != null && razon.length() > 300) razon = razon.substring(0, 300);

        ReembolsoLinea r = reembolsos.save(ReembolsoLinea.builder()
                .transaccionId(t.getId()).monto(monto).motivo(razon).hechoPor(usuario).build());
        try {
            Refund refund = stripe.reembolsar(t.getStripeAccountId(), t.getPaymentIntentId(),
                    CobrosLineaService.centavos(monto), razon, "reembolso-" + r.getId());
            r.setStripeRefundId(refund.getId());
            r.setEstado("failed".equals(refund.getStatus()) || "canceled".equals(refund.getStatus())
                    ? ReembolsoLinea.Estado.FALLIDO : ReembolsoLinea.Estado.HECHO);
        } catch (StripeException e) {
            log.error("Stripe: no se pudo devolver ${} del cobro {}: {}", monto, t.getPaymentIntentId(), e.getMessage());
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                    "Stripe no pudo hacer la devolución: " + (e.getUserMessage() != null ? e.getUserMessage() : "intenta de nuevo."));
        }
        reembolsos.save(r);
        if (r.getEstado() == ReembolsoLinea.Estado.FALLIDO) {
            throw new IllegalStateException("Stripe rechazó la devolución. Revísalo en tu panel de Stripe.");
        }
        sumarReembolso(t, monto);
        bitacora.anotar(t.getRestaurantId(), Accion.REEMBOLSO, "Devolución de $" + monto.toPlainString()
                + " del pedido " + codigoDe(t.getOrderId()) + (razon != null ? ": " + razon : ""), usuario);
    }

    private void sumarReembolso(TransaccionLinea t, BigDecimal monto) {
        t.setMontoReembolsado(t.getMontoReembolsado().add(monto));
        t.setEstado(t.getMontoReembolsado().compareTo(t.getMonto()) >= 0 ? Estado.REEMBOLSADO : Estado.REEMBOLSO_PARCIAL);
        t.setActualizadoEn(LocalDateTime.now());
        transacciones.save(t);
    }

    // ------------------------------------------------------------------
    // Stripe avisa: devoluciones hechas en su panel y disputas
    // ------------------------------------------------------------------

    /** Las devoluciones que se hicieron desde el panel de Stripe tambien quedan aqui. */
    @Transactional
    public void sincronizarReembolsos(String cuenta, String paymentIntentId) throws StripeException {
        TransaccionLinea t = transacciones.findByPaymentIntentId(paymentIntentId).orElse(null);
        if (t == null || !t.getStripeAccountId().equals(cuenta)) return;
        List<Refund> lista = stripe.reembolsos(cuenta, paymentIntentId);
        em.refresh(t, LockModeType.PESSIMISTIC_WRITE);
        for (Refund refund : lista) {
            if (!"succeeded".equals(refund.getStatus()) && !"pending".equals(refund.getStatus())) continue;
            if (reembolsos.findByStripeRefundId(refund.getId()).isPresent()) continue;
            BigDecimal monto = BigDecimal.valueOf(refund.getAmount()).movePointLeft(2);
            reembolsos.save(ReembolsoLinea.builder().transaccionId(t.getId()).stripeRefundId(refund.getId())
                    .monto(monto).motivo("Hecho desde el panel de Stripe").estado(ReembolsoLinea.Estado.HECHO)
                    .hechoPor("Stripe").build());
            sumarReembolso(t, monto);
            bitacora.anotar(t.getRestaurantId(), Accion.REEMBOLSO, "Devolución de $" + monto.toPlainString()
                    + " del pedido " + codigoDe(t.getOrderId()) + " hecha en Stripe", "Stripe");
        }
    }

    /** Un cliente desconocio el cargo con su banco: queda anotado para que el dueño responda en Stripe. */
    @Transactional
    public void disputa(String cuenta, String paymentIntentId, long centavos, String razon) {
        TransaccionLinea t = transacciones.findByPaymentIntentId(paymentIntentId).orElse(null);
        if (t == null || !t.getStripeAccountId().equals(cuenta)) return;
        bitacora.anotar(t.getRestaurantId(), Accion.DISPUTA, "El cliente desconoció el cargo de $"
                + BigDecimal.valueOf(centavos).movePointLeft(2).toPlainString() + " del pedido " + codigoDe(t.getOrderId())
                + (razon != null ? " (" + razon + ")" : "") + ". Respóndelo en tu panel de Stripe.", "Stripe");
    }

    // ------------------------------------------------------------------
    // Apoyos
    // ------------------------------------------------------------------

    private Detalle detalleDe(CustomUserDetails u, TransaccionLinea t) {
        List<Reembolso> lista = reembolsos.findByTransaccionIdOrderByCreadoEnAsc(t.getId()).stream()
                .map(r -> new Reembolso(r.getId(), r.getMonto(), r.getMotivo(), r.getEstado(), r.getHechoPor(), r.getCreadoEn()))
                .toList();
        boolean puede = puedeReembolsar(u) && (t.getEstado() == Estado.PAGADO || t.getEstado() == Estado.REEMBOLSO_PARCIAL);
        return new Detalle(filas(List.of(t)).get(0), t.getPaymentIntentId(), reembolsable(t), lista, puede);
    }

    private List<Fila> filas(List<TransaccionLinea> lista) {
        Set<UUID> idsPedido = lista.stream().map(TransaccionLinea::getOrderId).collect(Collectors.toSet());
        Set<UUID> idsSucursal = lista.stream().map(TransaccionLinea::getBranchId).collect(Collectors.toCollection(HashSet::new));
        Map<UUID, Order> porPedido = pedidos.findAllById(idsPedido).stream()
                .collect(Collectors.toMap(Order::getId, Function.identity()));
        Map<UUID, String> nombreSucursal = sucursales.findAllById(idsSucursal).stream()
                .collect(Collectors.toMap(Branch::getId, Branch::getName));
        return lista.stream().map(t -> {
            Order o = porPedido.get(t.getOrderId());
            BigDecimal stripeFee = t.getComisionStripe() != null ? t.getComisionStripe() : BigDecimal.ZERO;
            BigDecimal neto = COBRADOS.contains(t.getEstado())
                    ? t.getMonto().subtract(stripeFee).subtract(t.getComisionPlataforma()).subtract(t.getMontoReembolsado())
                    : BigDecimal.ZERO;
            return new Fila(t.getId(), t.getCreadoEn(), t.getPagadoEn(), nombreSucursal.get(t.getBranchId()),
                    t.getOrderId(), o != null ? codigo(o) : null, t.getEstado(), t.getMonto(), t.getPropina(),
                    t.getMontoReembolsado(), t.getComisionStripe(), t.getComisionPlataforma(),
                    neto.setScale(2, RoundingMode.HALF_UP), t.getMarcaTarjeta(), t.getUltimos4(), t.getClienteRef(),
                    t.getError());
        }).toList();
    }

    private static BigDecimal reembolsable(TransaccionLinea t) {
        return COBRADOS.contains(t.getEstado()) ? t.getMonto().subtract(t.getMontoReembolsado()).max(BigDecimal.ZERO)
                : BigDecimal.ZERO;
    }

    private String codigoDe(UUID orderId) {
        return pedidos.findById(orderId).map(TransaccionesLineaService::codigo).orElse("?");
    }

    private static String codigo(Order o) {
        return o.getTurno() != null ? o.getTurno() : o.getTokenSeguimiento();
    }

    private TransaccionLinea propia(UUID restaurantId, UUID id) {
        return transacciones.findById(id).filter(t -> restaurantId.equals(t.getRestaurantId()))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Cobro no encontrado."));
    }

    private static UUID exigirConsulta(CustomUserDetails u) {
        if (u == null || u.restaurantId() == null || !(puedeReembolsar(u) || tienePermiso(u, "CAJA_OPERAR"))) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "No tienes acceso a los cobros en línea.");
        }
        return u.restaurantId();
    }

    private static UUID exigirReembolso(CustomUserDetails u) {
        if (u == null || u.restaurantId() == null || !puedeReembolsar(u)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Solo el dueño o el gerente pueden devolver un pago.");
        }
        return u.restaurantId();
    }

    private static boolean puedeReembolsar(CustomUserDetails u) {
        return u != null && u.roleName() != null && REEMBOLSAN.contains(u.roleName().toUpperCase());
    }

    private static boolean tienePermiso(CustomUserDetails u, String permiso) {
        return u.authorities() != null && u.authorities().stream().map(GrantedAuthority::getAuthority)
                .anyMatch(permiso::equals);
    }
}
