package com.omnirest.omnirest_backend.services;

import com.omnirest.omnirest_backend.domain.entities.CobroSuscripcion;
import com.omnirest.omnirest_backend.domain.entities.Restaurant;
import com.omnirest.omnirest_backend.repositories.CobroSuscripcionRepository;
import com.omnirest.omnirest_backend.repositories.RestaurantRepository;
import com.omnirest.omnirest_backend.security.CustomUserDetails;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * El historial de la renta del sistema: lo que paga cada restaurante.
 *
 * Los cobros con tarjeta llegan solos desde Stripe; los pagos en efectivo los
 * registra el operador con su recibo. Un cobro nunca se borra: si fue un
 * error se anula con motivo, y el historial lo sigue mostrando.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class RentaService {

    /** Días antes de que venza una prueba para avisarla en el resumen. */
    static final int DIAS_AVISO_PRUEBA = 7;

    private final CobroSuscripcionRepository cobroRepository;
    private final RestaurantRepository restaurantRepository;
    private final AvisosSistemaService avisos;

    public record CobroDTO(UUID id, UUID restaurantId, String restaurante, String metodo, String estado,
                           BigDecimal monto, String moneda, String plan, LocalDate periodoDesde, LocalDate periodoHasta,
                           String referencia, String notas, String registradoPor, LocalDateTime pagadoEn,
                           LocalDateTime creadoEn, String anuladoMotivo) {
    }

    public record NuevoPagoEfectivo(UUID restaurantId, BigDecimal monto, LocalDate periodoDesde, LocalDate periodoHasta,
                                    String plan, String referencia, String notas) {
    }

    /** Cómo va un restaurante con su renta. */
    public record EstadoRenta(UUID restaurantId, String restaurante, String plan, String estadoSuscripcion,
                              boolean demo, boolean activo, LocalDateTime pruebaHasta, LocalDate pagadoHasta,
                              LocalDateTime ultimoPago, BigDecimal ultimoMonto, boolean vencido, boolean ultimoFallido) {
    }

    public record Resumen(BigDecimal cobradoEsteMes, long cobrosEsteMes, long vencidos, long fallidos,
                          long pruebasPorVencer, List<EstadoRenta> restaurantes) {
    }

    // ------------------------------------------------------------------
    // Stripe
    // ------------------------------------------------------------------

    /**
     * Una factura de Stripe (pagada o fallida). Idempotente: Stripe puede
     * mandar el mismo aviso varias veces y solo se registra una.
     */
    @Transactional
    public void registrarStripe(UUID restaurantId, String factura, boolean pagada, BigDecimal monto, String moneda,
                                LocalDate desde, LocalDate hasta) {
        CobroSuscripcion.Estado estado = pagada ? CobroSuscripcion.Estado.PAGADO : CobroSuscripcion.Estado.FALLIDO;
        if (factura != null && cobroRepository.existsByMetodoAndReferenciaAndEstado(CobroSuscripcion.Metodo.STRIPE, factura, estado)) {
            log.info("Renta: la factura {} ({}) ya estaba registrada", factura, estado);
            return;
        }
        Restaurant restaurant = restaurantRepository.findById(restaurantId).orElse(null);
        if (restaurant == null) {
            log.warn("Renta: factura {} de un restaurante que no existe ({})", factura, restaurantId);
            return;
        }
        cobroRepository.save(CobroSuscripcion.builder()
                .restaurantId(restaurantId)
                .metodo(CobroSuscripcion.Metodo.STRIPE)
                .estado(estado)
                .monto(dinero(monto))
                .moneda(moneda != null ? moneda.toUpperCase() : "MXN")
                .plan(restaurant.getSubscriptionPlan())
                .periodoDesde(desde)
                .periodoHasta(hasta)
                .referencia(factura)
                .registradoPor("Stripe")
                .pagadoEn(pagada ? LocalDateTime.now() : null)
                .build());

        if (pagada) {
            restaurant.setSubscriptionStatus("ACTIVE");
            restaurantRepository.save(restaurant);
            avisos.avisar(restaurantId, "RENTA", "Recibimos tu pago de Pide Fácil",
                    "Pagaste $" + dinero(monto) + (hasta != null ? " · cubre hasta el " + hasta : "") + ". ¡Gracias!");
        } else {
            restaurant.setSubscriptionStatus("PAST_DUE");
            restaurantRepository.save(restaurant);
            avisos.avisar(restaurantId, "RENTA", "No pudimos cobrar tu renta de Pide Fácil",
                    "Revisa tu tarjeta en Ajustes para que el servicio no se suspenda.");
        }
        log.info("Renta: factura {} de {} registrada como {}", factura, restaurant.getName(), estado);
    }

    // ------------------------------------------------------------------
    // Efectivo
    // ------------------------------------------------------------------

    @Transactional
    public CobroDTO registrarEfectivo(CustomUserDetails operador, NuevoPagoEfectivo p) {
        if (p.restaurantId() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Elige el restaurante.");
        }
        Restaurant restaurant = restaurantRepository.findById(p.restaurantId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Restaurante no encontrado."));
        if (p.monto() == null || p.monto().signum() <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Escribe cuánto pagó.");
        }
        if (p.periodoDesde() == null || p.periodoHasta() == null || p.periodoHasta().isBefore(p.periodoDesde())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Indica el periodo que cubre el pago.");
        }

        CobroSuscripcion cobro = cobroRepository.save(CobroSuscripcion.builder()
                .restaurantId(restaurant.getId())
                .metodo(CobroSuscripcion.Metodo.EFECTIVO)
                .estado(CobroSuscripcion.Estado.PAGADO)
                .monto(dinero(p.monto()))
                .plan(p.plan() != null && !p.plan().isBlank() ? p.plan().trim() : restaurant.getSubscriptionPlan())
                .periodoDesde(p.periodoDesde())
                .periodoHasta(p.periodoHasta())
                .referencia(limpio(p.referencia(), 120))
                .notas(limpio(p.notas(), 300))
                .registradoPor(operador != null ? operador.username() : null)
                .pagadoEn(LocalDateTime.now())
                .build());

        restaurant.setSubscriptionStatus("ACTIVE");
        restaurantRepository.save(restaurant);
        avisos.avisar(restaurant.getId(), "RENTA", "Registramos tu pago en efectivo",
                "$" + cobro.getMonto() + " · cubre del " + p.periodoDesde() + " al " + p.periodoHasta()
                        + (cobro.getReferencia() != null ? " · recibo " + cobro.getReferencia() : "") + ".");
        log.info("Renta: {} registró ${} en efectivo de {}", cobro.getRegistradoPor(), cobro.getMonto(), restaurant.getName());
        return aDto(cobro, restaurant.getName());
    }

    /** Un cobro registrado por error no se borra: se anula y queda el motivo. */
    @Transactional
    public CobroDTO anular(CustomUserDetails operador, UUID cobroId, String motivo) {
        CobroSuscripcion cobro = cobroRepository.findById(cobroId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Cobro no encontrado."));
        if (cobro.getEstado() == CobroSuscripcion.Estado.ANULADO) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Ese cobro ya estaba anulado.");
        }
        if (cobro.getMetodo() == CobroSuscripcion.Metodo.STRIPE) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Los cobros de Stripe se reembolsan desde Stripe, no aquí.");
        }
        String limpio = limpio(motivo, 300);
        if (limpio == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Escribe por qué se anula.");
        }
        cobro.setEstado(CobroSuscripcion.Estado.ANULADO);
        cobro.setAnuladoMotivo(limpio + (operador != null ? " (" + operador.username() + ")" : ""));
        return aDto(cobroRepository.save(cobro), nombreDe(cobro.getRestaurantId()));
    }

    // ------------------------------------------------------------------
    // Consultas
    // ------------------------------------------------------------------

    @Transactional(readOnly = true)
    public List<CobroDTO> historial(UUID restaurantId) {
        String nombre = nombreDe(restaurantId);
        return cobroRepository.findByRestaurantIdOrderByCreadoEnDesc(restaurantId).stream()
                .map(c -> aDto(c, nombre))
                .toList();
    }

    /** El panorama de la plataforma: lo cobrado este mes, quién debe y qué pruebas vencen. */
    @Transactional(readOnly = true)
    public Resumen resumen() {
        LocalDate hoy = LocalDate.now();
        LocalDateTime inicioDeMes = hoy.withDayOfMonth(1).atStartOfDay();
        List<CobroSuscripcion> recientes = cobroRepository.findTop200ByOrderByCreadoEnDesc();
        Map<UUID, List<CobroSuscripcion>> porRestaurante = cobroRepository.findAll().stream()
                .collect(Collectors.groupingBy(CobroSuscripcion::getRestaurantId));

        List<EstadoRenta> estados = restaurantRepository.findAll().stream()
                .filter(r -> r.getId() != null && !new UUID(0, 0).equals(r.getId()))
                .map(r -> estadoDe(r, porRestaurante.getOrDefault(r.getId(), List.of()), hoy))
                .sorted(Comparator.comparing(EstadoRenta::vencido).reversed()
                        .thenComparing(EstadoRenta::restaurante, Comparator.nullsLast(String.CASE_INSENSITIVE_ORDER)))
                .toList();

        List<CobroSuscripcion> delMes = recientes.stream()
                .filter(c -> c.getEstado() == CobroSuscripcion.Estado.PAGADO && c.getPagadoEn() != null
                        && !c.getPagadoEn().isBefore(inicioDeMes))
                .toList();
        LocalDateTime limitePrueba = hoy.plusDays(DIAS_AVISO_PRUEBA).atTime(23, 59);
        return new Resumen(
                delMes.stream().map(CobroSuscripcion::getMonto).reduce(BigDecimal.ZERO, BigDecimal::add),
                delMes.size(),
                estados.stream().filter(EstadoRenta::vencido).count(),
                estados.stream().filter(EstadoRenta::ultimoFallido).count(),
                estados.stream().filter(e -> e.pruebaHasta() != null && !e.pruebaHasta().isBefore(hoy.atStartOfDay())
                        && e.pruebaHasta().isBefore(limitePrueba)).count(),
                estados);
    }

    /**
     * "Vencido" = su último pago cubre hasta antes de hoy, o nunca ha pagado y
     * su prueba ya terminó. La demo y los desactivados no cuentan.
     */
    static EstadoRenta estadoDe(Restaurant r, List<CobroSuscripcion> cobros, LocalDate hoy) {
        Optional<CobroSuscripcion> ultimoPagado = cobros.stream()
                .filter(c -> c.getEstado() == CobroSuscripcion.Estado.PAGADO)
                .max(Comparator.comparing(c -> c.getPagadoEn() != null ? c.getPagadoEn() : LocalDateTime.MIN));
        LocalDate pagadoHasta = cobros.stream()
                .filter(c -> c.getEstado() == CobroSuscripcion.Estado.PAGADO && c.getPeriodoHasta() != null)
                .map(CobroSuscripcion::getPeriodoHasta)
                .max(Comparator.naturalOrder())
                .orElse(null);
        Optional<CobroSuscripcion> ultimo = cobros.stream()
                .filter(c -> c.getEstado() != CobroSuscripcion.Estado.ANULADO)
                .max(Comparator.comparing(c -> c.getCreadoEn() != null ? c.getCreadoEn() : LocalDateTime.MIN));

        boolean demo = Boolean.TRUE.equals(r.getIsDemo());
        boolean activo = !Boolean.FALSE.equals(r.getActive());
        boolean pruebaVigente = r.getTrialEndsAt() != null && r.getTrialEndsAt().isAfter(hoy.atStartOfDay());
        boolean vencido = !demo && activo && (pagadoHasta != null
                ? pagadoHasta.isBefore(hoy)
                : !pruebaVigente && r.getTrialEndsAt() != null);

        return new EstadoRenta(r.getId(), r.getName(), r.getSubscriptionPlan(), r.getSubscriptionStatus(), demo, activo,
                r.getTrialEndsAt(), pagadoHasta,
                ultimoPagado.map(CobroSuscripcion::getPagadoEn).orElse(null),
                ultimoPagado.map(CobroSuscripcion::getMonto).orElse(null),
                vencido,
                ultimo.map(c -> c.getEstado() == CobroSuscripcion.Estado.FALLIDO).orElse(false));
    }

    private String nombreDe(UUID restaurantId) {
        return restaurantRepository.findById(restaurantId).map(Restaurant::getName).orElse("");
    }

    private static CobroDTO aDto(CobroSuscripcion c, String restaurante) {
        return new CobroDTO(c.getId(), c.getRestaurantId(), restaurante, c.getMetodo().name(), c.getEstado().name(),
                c.getMonto(), c.getMoneda(), c.getPlan(), c.getPeriodoDesde(), c.getPeriodoHasta(), c.getReferencia(),
                c.getNotas(), c.getRegistradoPor(), c.getPagadoEn(), c.getCreadoEn(), c.getAnuladoMotivo());
    }

    private static BigDecimal dinero(BigDecimal valor) {
        return (valor != null ? valor : BigDecimal.ZERO).setScale(2, RoundingMode.HALF_UP);
    }

    private static String limpio(String texto, int max) {
        if (texto == null || texto.isBlank()) return null;
        String t = texto.trim();
        return t.length() > max ? t.substring(0, max) : t;
    }
}
