package com.omnirest.omnirest_backend.services;

import com.omnirest.omnirest_backend.domain.entities.CorteRepartidor;
import com.omnirest.omnirest_backend.domain.entities.MensajeWhatsapp;
import com.omnirest.omnirest_backend.domain.entities.MovimientoCaja;
import com.omnirest.omnirest_backend.domain.entities.Order;
import com.omnirest.omnirest_backend.domain.entities.Pago;
import com.omnirest.omnirest_backend.domain.entities.PaymentMethod;
import com.omnirest.omnirest_backend.domain.entities.TurnoCaja;
import com.omnirest.omnirest_backend.domain.enums.OrderStatus;
import com.omnirest.omnirest_backend.domain.enums.OrderType;
import com.omnirest.omnirest_backend.dtos.BillSummaryDTO;
import com.omnirest.omnirest_backend.dtos.CajaDTOs;
import com.omnirest.omnirest_backend.repositories.CorteRepartidorRepository;
import com.omnirest.omnirest_backend.repositories.MovimientoCajaRepository;
import com.omnirest.omnirest_backend.repositories.OrderRepository;
import com.omnirest.omnirest_backend.repositories.PagoRepository;
import com.omnirest.omnirest_backend.repositories.PaymentMethodRepository;
import com.omnirest.omnirest_backend.repositories.TurnoCajaRepository;
import com.omnirest.omnirest_backend.security.CustomUserDetails;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * La caja de la sucursal: una sola abierta a la vez.
 *
 * Se abre con un fondo; ahi caen los cobros en efectivo, las entradas y
 * salidas de efectivo y los cortes de los repartidores. Se cierra contando el
 * efectivo a ciegas: mientras esta abierta nadie ve cuanto deberia haber, y
 * el esperado y la diferencia se calculan y se congelan al cerrar.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class CajaService {

    private static final DateTimeFormatter HORA = DateTimeFormatter.ofPattern("HH:mm");

    private final TurnoCajaRepository turnoRepository;
    private final PagoRepository pagoRepository;
    private final MovimientoCajaRepository movimientoRepository;
    private final CorteRepartidorRepository corteRepository;
    private final PaymentMethodRepository paymentMethodRepository;
    private final OrderRepository orderRepository;
    private final OrderService orderService;
    private final ColaWhatsapp colaWhatsapp;

    // ------------------------------------------------------------------
    // Abrir y consultar
    // ------------------------------------------------------------------

    @Transactional(readOnly = true)
    public Optional<TurnoCaja> abierta(UUID branchId) {
        return turnoRepository.findByBranchIdAndCerradoEnIsNull(branchId);
    }

    /** La caja abierta, o un error que dice que hay que abrirla. */
    @Transactional(readOnly = true)
    public TurnoCaja exigirAbierta(UUID branchId) {
        return abierta(branchId).orElseThrow(() -> new IllegalStateException(
                "La caja está cerrada. Ábrela en Caja para poder cobrar."));
    }

    @Transactional
    public CajaDTOs.EstadoCaja abrir(UUID branchId, BigDecimal fondoInicial, CustomUserDetails user) {
        abierta(branchId).ifPresent(t -> {
            throw new IllegalStateException("La caja ya está abierta desde las " + t.getAbiertoEn().format(HORA)
                    + (t.getAbiertoPorNombre() != null ? " (" + t.getAbiertoPorNombre() + ")" : "") + ".");
        });
        TurnoCaja turno = turnoRepository.save(TurnoCaja.builder()
                .branchId(branchId)
                .abiertoPor(user != null ? user.id() : null)
                .abiertoPorNombre(nombre(user))
                .abiertoEn(LocalDateTime.now())
                .fondoInicial(dinero(fondoInicial))
                .build());
        log.info("Caja abierta en sucursal {} con fondo ${} por {}", branchId, turno.getFondoInicial(), nombre(user));
        return estadoDe(turno);
    }

    /** La caja abierta para quien la opera, sin ventas ni esperado. Vacio si esta cerrada. */
    @Transactional(readOnly = true)
    public Optional<CajaDTOs.EstadoCaja> estado(UUID branchId) {
        return abierta(branchId).map(this::estadoDe);
    }

    private CajaDTOs.EstadoCaja estadoDe(TurnoCaja t) {
        return new CajaDTOs.EstadoCaja(t.getId(), t.getAbiertoPorNombre(), t.getAbiertoEn(), t.getFondoInicial(),
                pagoRepository.cuentasCobradas(t.getId()),
                corteRepository.countByTurnoId(t.getId()),
                movimientoRepository.findByTurnoIdOrderByCreadoEnAsc(t.getId()).stream().map(CajaService::aDto).toList());
    }

    // ------------------------------------------------------------------
    // Efectivo que entra o sale
    // ------------------------------------------------------------------

    @Transactional
    public CajaDTOs.MovimientoDTO registrarMovimiento(UUID branchId, CajaDTOs.NuevoMovimiento peticion,
                                                      CustomUserDetails user) {
        TurnoCaja turno = exigirAbierta(branchId);
        MovimientoCaja.Tipo tipo;
        try {
            tipo = MovimientoCaja.Tipo.valueOf(peticion.tipo().trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("El movimiento es ENTRADA o SALIDA.");
        }
        MovimientoCaja movimiento = movimientoRepository.save(MovimientoCaja.builder()
                .turnoId(turno.getId())
                .tipo(tipo)
                .monto(dinero(peticion.monto()))
                .concepto(peticion.concepto().trim())
                .por(nombre(user))
                .build());
        log.info("Caja {}: {} de ${} ({})", turno.getId(), tipo, movimiento.getMonto(), movimiento.getConcepto());
        return aDto(movimiento);
    }

    /**
     * El efectivo que sale del cajón para pagarle a un proveedor. Sin caja
     * abierta no se puede: el dinero tiene que salir de un turno para que el
     * arqueo cuadre.
     *
     * @return el movimiento de caja, para ligarlo a la compra.
     */
    @Transactional
    public UUID salidaPorCompra(UUID branchId, BigDecimal monto, String concepto, String por) {
        TurnoCaja turno = abierta(branchId).orElseThrow(() -> new IllegalStateException(
                "La caja está cerrada: ábrela en Caja para pagar con efectivo, o registra la compra como transferencia o a crédito."));
        MovimientoCaja m = movimientoRepository.save(MovimientoCaja.builder()
                .turnoId(turno.getId())
                .tipo(MovimientoCaja.Tipo.SALIDA)
                .monto(dinero(monto))
                .concepto(recortar(concepto))
                .por(por)
                .build());
        log.info("Caja {}: salida de ${} por compra ({})", turno.getId(), m.getMonto(), m.getConcepto());
        return m.getId();
    }

    /** Se anuló una compra pagada en efectivo: el dinero regresa a la caja abierta. */
    @Transactional
    public void entradaPorCompraAnulada(UUID branchId, BigDecimal monto, String concepto, String por) {
        TurnoCaja turno = abierta(branchId).orElseThrow(() -> new IllegalStateException(
                "La caja está cerrada: ábrela en Caja para regresar el efectivo de esta compra."));
        movimientoRepository.save(MovimientoCaja.builder()
                .turnoId(turno.getId())
                .tipo(MovimientoCaja.Tipo.ENTRADA)
                .monto(dinero(monto))
                .concepto(recortar(concepto))
                .por(por)
                .build());
    }

    private static String recortar(String texto) {
        return texto != null && texto.length() > 200 ? texto.substring(0, 200) : texto;
    }

    // ------------------------------------------------------------------
    // Cobrar una cuenta
    // ------------------------------------------------------------------

    /**
     * Cobra la cuenta de una mesa y la cierra. Los pagos tienen que sumar
     * exactamente lo que falta por pagar; la propina va aparte. Si algo falla
     * (la cocina no termina, un metodo no existe) no se guarda nada.
     */
    @Transactional
    public CajaDTOs.CobroResultado cobrar(UUID branchId, UUID orderId, List<CajaDTOs.PagoPeticion> peticiones,
                                          CustomUserDetails user) {
        Order order = orderRepository.findById(orderId)
                .filter(o -> o.getBranch() != null && branchId.equals(o.getBranch().getId()))
                .orElseThrow(() -> new IllegalArgumentException("Cuenta no encontrada en esta sucursal."));
        if (order.getStatus() != OrderStatus.OPEN) {
            throw new IllegalStateException("Esta cuenta ya está cerrada.");
        }
        if (order.getOrderType() != null && order.getOrderType() != OrderType.SALON) {
            throw new IllegalStateException("Los pedidos a domicilio y para llevar se cobran al entregarse.");
        }
        List<Pago> pagos = registrarPagos(branchId, orderId, peticiones, user);
        // El ticket se arma antes de cerrar: ya cerrada, la cuenta no se recalcula.
        BillSummaryDTO cuenta = orderService.getBill(branchId, orderId);

        // Cierra y libera la mesa con las mismas reglas de siempre (la cocina
        // tiene que haber terminado). Si no puede, se deshacen los pagos.
        orderService.closeOrder(branchId, orderId);

        // Sale solo si el cobro se confirma; si la mesa no tiene WhatsApp, no se manda.
        if (cuenta.telefonoCliente() != null && !cuenta.telefonoCliente().isBlank()) {
            colaWhatsapp.encolar(branchId, cuenta.telefonoCliente(),
                    ticketPagado(cuenta, pagoRepository.findByOrderId(orderId)),
                    MensajeWhatsapp.Motivo.TICKET, "ticket:" + orderId);
        }
        return resultado(orderId, pagos);
    }

    /** El ticket que recibe el cliente: lo que consumió, cómo pagó, propina y cambio. */
    static String ticketPagado(BillSummaryDTO cuenta, List<Pago> pagos) {
        String detalle = cuenta.formattedBillText() != null
                ? cuenta.formattedBillText().replace("TOTAL A PAGAR:", "TOTAL:") : "";
        StringBuilder sb = new StringBuilder("✅ *Pago recibido.* ¡Gracias por tu visita!\n\n").append(detalle);
        if (!pagos.isEmpty()) {
            sb.append("\n*Pagaste con:*\n");
            for (Pago p : pagos) {
                sb.append("• ").append(p.getMetodo()).append(": $").append(dinero(p.getMonto())).append("\n");
            }
            BigDecimal propina = pagos.stream().map(Pago::getPropina).map(CajaService::dinero)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
            if (propina.signum() > 0) {
                sb.append("Propina: $").append(propina).append("\n");
            }
            BigDecimal cambio = pagos.stream().map(Pago::getCambio).filter(java.util.Objects::nonNull)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
            if (cambio.signum() > 0) {
                sb.append("Cambio: $").append(dinero(cambio)).append("\n");
            }
        }
        return sb.toString();
    }

    /**
     * Guarda los pagos de una cuenta en la caja abierta. Tienen que sumar
     * exactamente lo que falta por pagar; la propina va aparte. No cierra la
     * cuenta: eso lo decide quien llama (la mesa se libera, el pedido de
     * mostrador entra a cocina).
     */
    @Transactional
    public List<Pago> registrarPagos(UUID branchId, UUID orderId, List<CajaDTOs.PagoPeticion> peticiones,
                                     CustomUserDetails user) {
        TurnoCaja turno = exigirAbierta(branchId);
        BigDecimal total = dinero(orderService.getBill(branchId, orderId).totalAmount());
        BigDecimal falta = total.subtract(dinero(pagoRepository.pagadoDe(orderId)));

        if (falta.signum() <= 0) {
            return List.of();
        }
        if (peticiones == null || peticiones.isEmpty()) {
            throw new IllegalArgumentException("Agrega al menos un pago.");
        }
        List<Pago> pagos = new ArrayList<>();
        BigDecimal suma = BigDecimal.ZERO;
        for (CajaDTOs.PagoPeticion p : peticiones) {
            Pago pago = armarPago(branchId, turno, orderId, p, user);
            suma = suma.add(pago.getMonto());
            pagos.add(pago);
        }
        if (suma.compareTo(falta) != 0) {
            throw new IllegalArgumentException("Los pagos suman $" + suma + " y la cuenta es de $" + falta + ".");
        }
        pagos = pagoRepository.saveAll(pagos);
        log.info("Cuenta {} cobrada en caja {}: ${} en {} pago(s)", orderId, turno.getId(), falta, pagos.size());
        return pagos;
    }

    /** Lo que se le muestra a quien cobro: total, propinas y cambio a entregar. */
    public CajaDTOs.CobroResultado resultado(UUID orderId, List<Pago> pagos) {
        BigDecimal total = pagos.stream().map(Pago::getMonto).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal propinas = pagos.stream().map(Pago::getPropina).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal cambio = pagos.stream().map(Pago::getCambio).filter(java.util.Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        return new CajaDTOs.CobroResultado(orderId, total, propinas, cambio,
                pagos.stream().map(CajaService::aDto).toList());
    }

    private Pago armarPago(UUID branchId, TurnoCaja turno, UUID orderId, CajaDTOs.PagoPeticion p,
                           CustomUserDetails user) {
        PaymentMethod metodo = paymentMethodRepository.findById(p.paymentMethodId())
                .filter(m -> m.getBranch() != null && branchId.equals(m.getBranch().getId()))
                .orElseThrow(() -> new IllegalArgumentException("Ese método de pago no es de esta sucursal."));
        if (!Boolean.TRUE.equals(metodo.getActive())) {
            throw new IllegalArgumentException(metodo.getName() + " está desactivado.");
        }
        BigDecimal monto = dinero(p.monto());
        if (monto.signum() <= 0) {
            throw new IllegalArgumentException("El monto de cada pago tiene que ser mayor a cero.");
        }
        BigDecimal propina = dinero(p.propina());
        if (propina.signum() < 0) {
            throw new IllegalArgumentException("La propina no puede ser negativa.");
        }
        boolean efectivo = Boolean.TRUE.equals(metodo.getEsEfectivo());

        BigDecimal recibido = null;
        BigDecimal cambio = null;
        if (efectivo && p.recibido() != null) {
            recibido = dinero(p.recibido());
            BigDecimal aPagar = monto.add(propina);
            if (recibido.compareTo(aPagar) < 0) {
                throw new IllegalArgumentException("Con $" + recibido + " no alcanza: son $" + aPagar + ".");
            }
            cambio = recibido.subtract(aPagar);
        }

        return Pago.builder()
                .orderId(orderId)
                .turnoId(turno.getId())
                .paymentMethodId(metodo.getId())
                .metodo(metodo.getName())
                .esEfectivo(efectivo)
                .monto(monto)
                .propina(propina)
                .recibido(recibido)
                .cambio(cambio)
                .cobradoPor(nombre(user))
                .build();
    }

    /**
     * Un pedido para llevar que se entrega en mostrador: se paga en efectivo
     * al recogerlo. No hace nada si ya tiene pagos o no hay nada que cobrar.
     */
    @Transactional
    public void cobrarEnEfectivoAlEntregar(Order order) {
        BigDecimal total = dinero(order.getTotalAmount()).add(dinero(order.getPropina()));
        if (total.signum() <= 0 || dinero(pagoRepository.pagadoDe(order.getId())).signum() > 0) {
            return;
        }
        UUID branchId = order.getBranch().getId();
        TurnoCaja turno = exigirAbierta(branchId);
        PaymentMethod efectivo = paymentMethodRepository.findByBranchId(branchId).stream()
                .filter(m -> Boolean.TRUE.equals(m.getEsEfectivo()))
                .findFirst()
                .orElse(null);
        pagoRepository.save(Pago.builder()
                .orderId(order.getId())
                .turnoId(turno.getId())
                .paymentMethodId(efectivo != null ? efectivo.getId() : null)
                .metodo(efectivo != null ? efectivo.getName() : "Efectivo")
                .esEfectivo(true)
                .monto(dinero(order.getTotalAmount()))
                .propina(dinero(order.getPropina()))
                .cobradoPor("Mostrador")
                .build());
    }

    // ------------------------------------------------------------------
    // Cierre y arqueo
    // ------------------------------------------------------------------

    /**
     * Cierra la caja con lo contado. Aqui, y no antes, se calcula lo que
     * deberia haber; esperado y diferencia quedan congelados en el turno.
     */
    @Transactional
    public CajaDTOs.Arqueo cerrar(UUID branchId, CajaDTOs.CerrarCaja peticion, CustomUserDetails user) {
        TurnoCaja turno = exigirAbierta(branchId);

        Map<String, Integer> conteo = null;
        BigDecimal contado;
        if (peticion.conteo() != null && !peticion.conteo().isEmpty()) {
            conteo = new LinkedHashMap<>();
            for (Map.Entry<String, Integer> e : peticion.conteo().entrySet()) {
                if (e.getValue() != null && e.getValue() != 0) {
                    conteo.merge(ArqueoCaja.normalizar(e.getKey()), e.getValue(), Integer::sum);
                }
            }
            contado = ArqueoCaja.totalConteo(conteo);
        } else if (peticion.efectivoContado() != null) {
            contado = dinero(peticion.efectivoContado());
        } else {
            throw new IllegalArgumentException("Captura lo que contaste: por billetes y monedas o el total.");
        }

        Calculo c = calcular(turno);
        turno.setCerradoEn(LocalDateTime.now());
        turno.setCerradoPor(user != null ? user.id() : null);
        turno.setCerradoPorNombre(nombre(user));
        turno.setEfectivoContado(contado);
        turno.setEfectivoEsperado(c.esperado());
        turno.setDiferencia(contado.subtract(c.esperado()));
        turno.setConteo(conteo);
        turno.setNotas(peticion.notas() != null && !peticion.notas().isBlank() ? peticion.notas().trim() : null);
        turno = turnoRepository.save(turno);

        log.info("Caja {} cerrada: esperado ${}, contado ${}, diferencia ${}",
                turno.getId(), c.esperado(), contado, turno.getDiferencia());
        return arqueoDe(turno, c);
    }

    /** El arqueo de un turno ya cerrado. El de la caja abierta no se muestra: se cuenta a ciegas. */
    @Transactional(readOnly = true)
    public CajaDTOs.Arqueo arqueo(UUID branchId, UUID turnoId) {
        TurnoCaja turno = turnoRepository.findByIdAndBranchId(turnoId, branchId)
                .orElseThrow(() -> new IllegalArgumentException("Turno de caja no encontrado en esta sucursal."));
        if (turno.abierto()) {
            throw new IllegalStateException("La caja sigue abierta: el arqueo se ve al cerrarla.");
        }
        return arqueoDe(turno, calcular(turno));
    }

    @Transactional(readOnly = true)
    public List<CajaDTOs.TurnoResumen> historial(UUID branchId) {
        return turnoRepository.findTop30ByBranchIdAndCerradoEnIsNotNullOrderByCerradoEnDesc(branchId).stream()
                .map(t -> new CajaDTOs.TurnoResumen(t.getId(), t.getAbiertoPorNombre(), t.getAbiertoEn(),
                        t.getCerradoPorNombre(), t.getCerradoEn(), t.getFondoInicial(), t.getEfectivoEsperado(),
                        t.getEfectivoContado(), t.getDiferencia()))
                .toList();
    }

    /** Lo que se junto en el turno, ya sumado. */
    private record Calculo(List<Pago> pagos, List<MovimientoCaja> movimientos, List<CorteRepartidor> cortes,
                           BigDecimal entradas, BigDecimal salidas, BigDecimal totalCortes, BigDecimal esperado) {
    }

    private Calculo calcular(TurnoCaja turno) {
        List<Pago> pagos = pagoRepository.findByTurnoIdOrderByCreadoEnAsc(turno.getId());
        List<MovimientoCaja> movimientos = movimientoRepository.findByTurnoIdOrderByCreadoEnAsc(turno.getId());
        List<CorteRepartidor> cortes = corteRepository.findByTurnoIdOrderByCreadoEnAsc(turno.getId());

        BigDecimal cobrosEfectivo = BigDecimal.ZERO;
        BigDecimal propinasEfectivo = BigDecimal.ZERO;
        for (Pago p : pagos) {
            if (Boolean.TRUE.equals(p.getEsEfectivo())) {
                cobrosEfectivo = cobrosEfectivo.add(p.getMonto());
                propinasEfectivo = propinasEfectivo.add(dinero(p.getPropina()));
            }
        }
        BigDecimal entradas = sumar(movimientos, MovimientoCaja.Tipo.ENTRADA);
        BigDecimal salidas = sumar(movimientos, MovimientoCaja.Tipo.SALIDA);
        BigDecimal totalCortes = cortes.stream().map(CorteRepartidor::getRecibido).map(CajaService::dinero)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal esperado = turno.abierto() || turno.getEfectivoEsperado() == null
                ? ArqueoCaja.esperado(turno.getFondoInicial(), cobrosEfectivo, propinasEfectivo, entradas, salidas, totalCortes)
                : turno.getEfectivoEsperado();
        return new Calculo(pagos, movimientos, cortes, entradas, salidas, totalCortes, esperado);
    }

    private CajaDTOs.Arqueo arqueoDe(TurnoCaja t, Calculo c) {
        Map<String, List<Pago>> porMetodo = new LinkedHashMap<>();
        for (Pago p : c.pagos()) {
            porMetodo.computeIfAbsent(p.getMetodo(), k -> new ArrayList<>()).add(p);
        }
        List<CajaDTOs.VentaPorMetodo> ventas = porMetodo.entrySet().stream()
                .map(e -> new CajaDTOs.VentaPorMetodo(
                        e.getKey(),
                        e.getValue().stream().anyMatch(p -> Boolean.TRUE.equals(p.getEsEfectivo())),
                        e.getValue().stream().map(Pago::getOrderId).distinct().count(),
                        e.getValue().stream().map(Pago::getMonto).reduce(BigDecimal.ZERO, BigDecimal::add),
                        e.getValue().stream().map(Pago::getPropina).map(CajaService::dinero)
                                .reduce(BigDecimal.ZERO, BigDecimal::add)))
                .toList();

        return new CajaDTOs.Arqueo(
                t.getId(), t.getAbiertoPorNombre(), t.getAbiertoEn(), t.getCerradoPorNombre(), t.getCerradoEn(),
                t.getFondoInicial(),
                c.pagos().stream().map(Pago::getOrderId).distinct().count(),
                ventas,
                ventas.stream().map(CajaDTOs.VentaPorMetodo::monto).reduce(BigDecimal.ZERO, BigDecimal::add),
                ventas.stream().map(CajaDTOs.VentaPorMetodo::propinas).reduce(BigDecimal.ZERO, BigDecimal::add),
                c.movimientos().stream().map(CajaService::aDto).toList(),
                c.entradas(), c.salidas(),
                c.cortes().stream()
                        .map(k -> new CajaDTOs.CorteEnCaja(k.getId(),
                                k.getDriver() != null ? k.getDriver().getNombre() : null,
                                k.getEntregas() != null ? k.getEntregas() : 0, k.getRecibido(), k.getCreadoEn()))
                        .toList(),
                c.totalCortes(),
                c.esperado(), t.getEfectivoContado(), t.getDiferencia(), t.getConteo(), t.getNotas());
    }

    // ------------------------------------------------------------------
    // Apoyos
    // ------------------------------------------------------------------

    private static BigDecimal sumar(List<MovimientoCaja> movimientos, MovimientoCaja.Tipo tipo) {
        return movimientos.stream().filter(m -> m.getTipo() == tipo).map(MovimientoCaja::getMonto)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private static CajaDTOs.MovimientoDTO aDto(MovimientoCaja m) {
        return new CajaDTOs.MovimientoDTO(m.getId(), m.getTipo().name(), m.getMonto(), m.getConcepto(), m.getPor(),
                m.getCreadoEn());
    }

    private static CajaDTOs.PagoDTO aDto(Pago p) {
        return new CajaDTOs.PagoDTO(p.getId(), p.getMetodo(), Boolean.TRUE.equals(p.getEsEfectivo()), p.getMonto(),
                p.getPropina(), p.getRecibido(), p.getCambio(), p.getCobradoPor(), p.getCreadoEn());
    }

    private static String nombre(CustomUserDetails user) {
        return user != null ? user.username() : null;
    }

    private static BigDecimal dinero(BigDecimal valor) {
        return (valor != null ? valor : BigDecimal.ZERO).setScale(2, RoundingMode.HALF_UP);
    }
}
