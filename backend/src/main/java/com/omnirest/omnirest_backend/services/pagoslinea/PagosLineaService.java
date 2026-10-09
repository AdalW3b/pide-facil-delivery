package com.omnirest.omnirest_backend.services.pagoslinea;

import com.omnirest.omnirest_backend.domain.entities.BitacoraPagoLinea;
import com.omnirest.omnirest_backend.domain.entities.PagosLineaConfig;
import com.omnirest.omnirest_backend.domain.entities.PagosLineaConfig.EstadoCuenta;
import com.omnirest.omnirest_backend.repositories.PagosLineaConfigRepository;
import com.omnirest.omnirest_backend.repositories.RestaurantRepository;
import com.omnirest.omnirest_backend.security.CustomUserDetails;
import com.omnirest.omnirest_backend.services.pagoslinea.BitacoraPagosLinea.Accion;
import com.stripe.exception.StripeException;
import com.stripe.model.Account;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Conectar la cuenta de Stripe de cada restaurante (Stripe Connect) y como
 * cobra en linea. Solo el dueño configura; la comision de Pide Facil la fija
 * el operador de la plataforma.
 */
@Service
@Slf4j
public class PagosLineaService {

    /** Lo mas que Pide Facil puede cobrar por pago. Igual que el CHECK de la base. */
    static final BigDecimal COMISION_MAXIMA = new BigDecimal("30");

    private final PagosLineaConfigRepository configuraciones;
    private final RestaurantRepository restaurantes;
    private final StripeConnect stripe;
    private final BitacoraPagosLinea bitacora;
    private final Set<String> origenesPermitidos;

    public PagosLineaService(PagosLineaConfigRepository configuraciones, RestaurantRepository restaurantes,
                             StripeConnect stripe, BitacoraPagosLinea bitacora,
                             @Value("${cors.allowed-origins:http://localhost:4200}") String origenes) {
        this.configuraciones = configuraciones;
        this.restaurantes = restaurantes;
        this.stripe = stripe;
        this.bitacora = bitacora;
        this.origenesPermitidos = Arrays.stream(origenes.split(","))
                .map(String::trim).map(o -> o.replaceAll("/+$", "")).filter(o -> !o.isEmpty())
                .collect(Collectors.toSet());
    }

    public record Estado(
            boolean servidorListo,
            boolean conectada,
            /** Solo los ultimos caracteres, para reconocerla. */
            String cuenta,
            EstadoCuenta estadoCuenta,
            String motivo,
            boolean activo,
            boolean modoPrueba,
            boolean aceptaTarjeta,
            boolean aceptaEfectivo,
            boolean aceptaEnTienda,
            BigDecimal comisionPlataformaPct,
            LocalDateTime conectadoEn) {
    }

    public record Ajustes(Boolean activo, Boolean aceptaTarjeta, Boolean aceptaEfectivo, Boolean aceptaEnTienda) {
    }

    public record Movimiento(String accion, String detalle, String usuario, LocalDateTime en) {
    }

    // ------------------------------------------------------------------
    // Dueño
    // ------------------------------------------------------------------

    public Estado estado(CustomUserDetails u) {
        return aEstado(config(restauranteDe(u)));
    }

    /**
     * La liga a Stripe para dar de alta (o terminar de llenar) la cuenta. La
     * primera vez se crea la cuenta del restaurante.
     *
     * @param origen la direccion del panel, para regresar ahi al terminar
     */
    @Transactional
    public String conectar(CustomUserDetails u, String origen) {
        UUID restaurantId = exigirDueno(u);
        String base = origenValido(origen);
        PagosLineaConfig c = config(restaurantId);
        try {
            if (c.getStripeAccountId() == null) {
                String nombre = restaurantes.findById(restaurantId).map(r -> r.getName()).orElse("Restaurante");
                Account cuenta = stripe.crearCuenta(restaurantId, nombre);
                c.setStripeAccountId(cuenta.getId());
                c.setModoPrueba(stripe.modoPrueba());
                c.setConectadoEn(LocalDateTime.now());
                aplicar(c, cuenta);
                guardar(c);
                bitacora.anotar(restaurantId, Accion.CONECTAR,
                        "Cuenta de Stripe creada " + mascara(cuenta.getId()) + (c.getModoPrueba() ? " (modo prueba)" : ""),
                        u.username());
            }
            String pantalla = base + "/settings/pagos-en-linea";
            return stripe.ligaDeAlta(c.getStripeAccountId(), pantalla + "?stripe=renovar", pantalla + "?stripe=regreso");
        } catch (StripeException e) {
            log.error("Stripe Connect: no se pudo conectar el restaurante {}: {}", restaurantId, e.getMessage());
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, explicar(e));
        }
    }

    /** Pregunta a Stripe como esta la cuenta. Sirve de "probar conexión". */
    @Transactional
    public Estado sincronizar(CustomUserDetails u) {
        UUID restaurantId = exigirDueno(u);
        PagosLineaConfig c = config(restaurantId);
        if (c.getStripeAccountId() == null) return aEstado(c);
        try {
            actualizar(c, stripe.cuenta(c.getStripeAccountId()));
        } catch (StripeException e) {
            log.warn("Stripe Connect: no se pudo leer la cuenta {} del restaurante {}: {}",
                    c.getStripeAccountId(), restaurantId, e.getMessage());
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, explicar(e));
        }
        return aEstado(c);
    }

    @Transactional
    public Estado ajustes(CustomUserDetails u, Ajustes a) {
        UUID restaurantId = exigirDueno(u);
        PagosLineaConfig c = config(restaurantId);

        boolean tarjeta = a.aceptaTarjeta() != null ? a.aceptaTarjeta() : c.getAceptaTarjeta();
        boolean efectivo = a.aceptaEfectivo() != null ? a.aceptaEfectivo() : c.getAceptaEfectivo();
        boolean tienda = a.aceptaEnTienda() != null ? a.aceptaEnTienda() : c.getAceptaEnTienda();
        if (!tarjeta && !efectivo && !tienda) {
            throw new IllegalArgumentException("Deja al menos una forma de pago para el menú en línea.");
        }
        boolean activo = a.activo() != null ? a.activo() : c.getActivo();
        if (activo && !c.getActivo() && c.getEstadoCuenta() != EstadoCuenta.LISTA) {
            throw new IllegalArgumentException("Primero termina de conectar tu cuenta de Stripe: todavía no puede cobrar.");
        }

        if (activo != c.getActivo()) {
            bitacora.anotar(restaurantId, activo ? Accion.ACTIVAR : Accion.DESACTIVAR,
                    activo ? "Pago con tarjeta en línea activado" : "Pago con tarjeta en línea desactivado", u.username());
        }
        if (tarjeta != c.getAceptaTarjeta() || efectivo != c.getAceptaEfectivo() || tienda != c.getAceptaEnTienda()) {
            bitacora.anotar(restaurantId, Accion.CONFIGURAR, "Formas de pago del menú: "
                    + String.join(", ", formas(tarjeta, efectivo, tienda)), u.username());
        }
        c.setActivo(activo);
        c.setAceptaTarjeta(tarjeta);
        c.setAceptaEfectivo(efectivo);
        c.setAceptaEnTienda(tienda);
        guardar(c);
        return aEstado(c);
    }

    /**
     * Quita la cuenta de Pide Facil. La cuenta sigue siendo del restaurante en
     * Stripe (con su dinero y su historial); solo deja de cobrarse con ella aqui.
     */
    @Transactional
    public Estado desconectar(CustomUserDetails u) {
        UUID restaurantId = exigirDueno(u);
        PagosLineaConfig c = config(restaurantId);
        if (c.getStripeAccountId() == null) return aEstado(c);
        bitacora.anotar(restaurantId, Accion.DESCONECTAR, "Cuenta " + mascara(c.getStripeAccountId()) + " desconectada",
                u.username());
        c.setStripeAccountId(null);
        c.setEstadoCuenta(EstadoCuenta.SIN_CONECTAR);
        c.setMotivoEstado(null);
        c.setActivo(false);
        c.setConectadoEn(null);
        guardar(c);
        return aEstado(c);
    }

    public List<Movimiento> bitacora(CustomUserDetails u) {
        UUID restaurantId = exigirDueno(u);
        return bitacora.recientes(restaurantId).stream().map(PagosLineaService::aMovimiento).toList();
    }

    // ------------------------------------------------------------------
    // Operador de la plataforma
    // ------------------------------------------------------------------

    public Estado estadoDe(UUID restaurantId) {
        exigirRestaurante(restaurantId);
        return aEstado(config(restaurantId));
    }

    /** Lo que se queda Pide Facil de cada pago, segun el trato con el dueño. 0 = solo la renta. */
    @Transactional
    public Estado fijarComision(UUID restaurantId, BigDecimal pct, CustomUserDetails operador) {
        exigirRestaurante(restaurantId);
        if (pct == null || pct.signum() < 0 || pct.compareTo(COMISION_MAXIMA) > 0) {
            throw new IllegalArgumentException("La comisión va de 0% a " + COMISION_MAXIMA.toPlainString() + "%.");
        }
        BigDecimal nueva = pct.setScale(2, RoundingMode.HALF_UP);
        PagosLineaConfig c = config(restaurantId);
        if (nueva.compareTo(c.getComisionPlataformaPct()) != 0) {
            bitacora.anotar(restaurantId, Accion.COMISION, "Comisión de Pide Fácil: "
                    + c.getComisionPlataformaPct().stripTrailingZeros().toPlainString() + "% → "
                    + nueva.stripTrailingZeros().toPlainString() + "%", operador.username());
            c.setComisionPlataformaPct(nueva);
            guardar(c);
        }
        return aEstado(c);
    }

    public List<Movimiento> bitacoraDe(UUID restaurantId) {
        return bitacora.recientes(restaurantId).stream().map(PagosLineaService::aMovimiento).toList();
    }

    // ------------------------------------------------------------------
    // Stripe avisa (account.updated)
    // ------------------------------------------------------------------

    /** Vuelve a leer la cuenta en Stripe y guarda su estado. Si no es de nadie aqui, no hace nada. */
    @Transactional
    public void actualizarCuenta(String cuentaId) throws StripeException {
        PagosLineaConfig c = configuraciones.findByStripeAccountId(cuentaId).orElse(null);
        if (c == null) {
            log.info("Stripe Connect: aviso de la cuenta {} que no esta conectada a ningun restaurante", cuentaId);
            return;
        }
        // Se lee la cuenta en vez de confiar en el evento: llegan fuera de orden.
        actualizar(c, stripe.cuenta(cuentaId));
    }

    // ------------------------------------------------------------------
    // Apoyos
    // ------------------------------------------------------------------

    private void actualizar(PagosLineaConfig c, Account cuenta) {
        EstadoCuenta antes = c.getEstadoCuenta();
        aplicar(c, cuenta);
        if (antes != c.getEstadoCuenta()) {
            bitacora.anotar(c.getRestaurantId(), Accion.ESTADO_CUENTA, antes + " → " + c.getEstadoCuenta()
                    + (c.getMotivoEstado() != null ? ": " + c.getMotivoEstado() : ""), "Stripe");
            if (c.getEstadoCuenta() == EstadoCuenta.DETENIDA && c.getActivo()) {
                // Stripe ya no deja cobrar: el menu deja de ofrecer la tarjeta.
                c.setActivo(false);
                bitacora.anotar(c.getRestaurantId(), Accion.DESACTIVAR, "Stripe detuvo los cobros de la cuenta", "Stripe");
            }
        }
        guardar(c);
    }

    /** Traduce lo que dice Stripe de la cuenta a nuestro estado. */
    static void aplicar(PagosLineaConfig c, Account cuenta) {
        String razon = cuenta.getRequirements() != null ? cuenta.getRequirements().getDisabledReason() : null;
        int faltan = cuenta.getRequirements() != null && cuenta.getRequirements().getCurrentlyDue() != null
                ? cuenta.getRequirements().getCurrentlyDue().size() : 0;

        if (Boolean.TRUE.equals(cuenta.getChargesEnabled())) {
            c.setEstadoCuenta(EstadoCuenta.LISTA);
            c.setMotivoEstado(faltan > 0 ? "Lista, pero Stripe pide " + faltan + " dato(s) más: complétalos para no perder los cobros." : null);
        } else if (razon != null && (razon.startsWith("rejected") || razon.equals("listed")
                || razon.equals("platform_paused") || razon.equals("other"))) {
            c.setEstadoCuenta(EstadoCuenta.DETENIDA);
            c.setMotivoEstado(motivo(razon));
        } else {
            c.setEstadoCuenta(EstadoCuenta.PENDIENTE);
            // Una cuenta recien creada ya trae "past_due": lo que falta es terminar el alta.
            c.setMotivoEstado(!Boolean.TRUE.equals(cuenta.getDetailsSubmitted()) ? "Falta terminar el alta en Stripe."
                    : razon != null ? motivo(razon)
                    : "Stripe está revisando la cuenta.");
        }
    }

    /** Lo que se le dice al dueño cuando Stripe falla: sin el detalle tecnico en ingles. */
    static String explicar(StripeException e) {
        String m = e.getMessage() == null ? "" : e.getMessage();
        if (m.contains("signed up for Connect")) {
            return "Stripe Connect todavía no está activado en la cuenta de Stripe de Pide Fácil. Avísale a soporte.";
        }
        if (m.contains("No such account") || m.contains("does not have access to account")) {
            return "Stripe ya no reconoce esta cuenta. Desconéctala y vuelve a conectarla.";
        }
        if (e.getStatusCode() != null && e.getStatusCode() == 401) {
            return "La llave de Stripe del sistema no es válida. Avísale a soporte.";
        }
        return "Stripe no respondió como se esperaba. Intenta de nuevo en unos minutos.";
    }

    static String motivo(String razon) {
        if (razon == null) return null;
        if (razon.startsWith("rejected")) return "Stripe rechazó la cuenta. Revisa el correo de Stripe o su panel.";
        return switch (razon) {
            case "requirements.past_due" -> "Stripe pide datos que ya vencieron: complétalos para poder cobrar.";
            case "requirements.pending_verification" -> "Stripe está verificando los datos que enviaste.";
            case "under_review" -> "Stripe está revisando la cuenta.";
            case "listed" -> "Stripe detuvo la cuenta para revisarla.";
            case "platform_paused" -> "La cuenta está en pausa.";
            case "action_required.requested_capabilities" -> "Falta terminar el alta en Stripe.";
            default -> "Stripe detuvo los cobros de la cuenta. Revisa su panel.";
        };
    }

    private Estado aEstado(PagosLineaConfig c) {
        return new Estado(stripe.configurado(), c.getStripeAccountId() != null, mascara(c.getStripeAccountId()),
                c.getEstadoCuenta(), c.getMotivoEstado(), c.getActivo(),
                c.getStripeAccountId() != null ? c.getModoPrueba() : stripe.modoPrueba(),
                c.getAceptaTarjeta(), c.getAceptaEfectivo(), c.getAceptaEnTienda(),
                c.getComisionPlataformaPct(), c.getConectadoEn());
    }

    private static Movimiento aMovimiento(BitacoraPagoLinea b) {
        return new Movimiento(b.getAccion(), b.getDetalle(), b.getUsuario(), b.getEn());
    }

    private PagosLineaConfig config(UUID restaurantId) {
        return configuraciones.findById(restaurantId)
                .orElseGet(() -> PagosLineaConfig.builder().restaurantId(restaurantId).build());
    }

    private void guardar(PagosLineaConfig c) {
        c.setActualizadoEn(LocalDateTime.now());
        configuraciones.save(c);
    }

    private String origenValido(String origen) {
        String o = origen == null ? "" : origen.trim().replaceAll("/+$", "");
        if (!origenesPermitidos.contains(o)) {
            // La liga de regreso no puede llevar a otro sitio.
            throw new IllegalArgumentException("Dirección de regreso no permitida.");
        }
        return o;
    }

    private void exigirRestaurante(UUID restaurantId) {
        if (restaurantId == null || !restaurantes.existsById(restaurantId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Restaurante no encontrado.");
        }
    }

    private static UUID restauranteDe(CustomUserDetails u) {
        return exigirDueno(u);
    }

    private static UUID exigirDueno(CustomUserDetails u) {
        if (u == null || !"SUPER_ADMIN".equalsIgnoreCase(u.roleName()) || u.restaurantId() == null) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Solo el dueño configura los pagos en línea.");
        }
        return u.restaurantId();
    }

    private static List<String> formas(boolean tarjeta, boolean efectivo, boolean tienda) {
        return java.util.stream.Stream.of(tarjeta ? "tarjeta en línea" : null, efectivo ? "efectivo al recibir" : null,
                tienda ? "pago en tienda" : null).filter(Objects::nonNull).toList();
    }

    /** acct_1AbCdEfGh → ••••EfGh */
    static String mascara(String cuenta) {
        if (cuenta == null) return null;
        return cuenta.length() <= 4 ? cuenta : "••••" + cuenta.substring(cuenta.length() - 4);
    }
}
