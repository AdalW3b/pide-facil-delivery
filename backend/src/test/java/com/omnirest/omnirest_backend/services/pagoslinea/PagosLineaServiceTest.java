package com.omnirest.omnirest_backend.services.pagoslinea;

import com.omnirest.omnirest_backend.domain.entities.PagosLineaConfig;
import com.omnirest.omnirest_backend.domain.entities.PagosLineaConfig.EstadoCuenta;
import com.omnirest.omnirest_backend.domain.entities.Restaurant;
import com.omnirest.omnirest_backend.repositories.PagosLineaConfigRepository;
import com.omnirest.omnirest_backend.repositories.RestaurantRepository;
import com.omnirest.omnirest_backend.security.CustomUserDetails;
import com.stripe.model.Account;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** Conectar la cuenta de Stripe del restaurante y sus ajustes. */
class PagosLineaServiceTest {

    private static final UUID RESTAURANTE = UUID.randomUUID();

    private final PagosLineaConfigRepository configs = mock(PagosLineaConfigRepository.class);
    private final RestaurantRepository restaurantes = mock(RestaurantRepository.class);
    private final StripeConnect stripe = mock(StripeConnect.class);
    private final BitacoraPagosLinea bitacora = mock(BitacoraPagosLinea.class);
    private final PagosLineaService servicio = new PagosLineaService(configs, restaurantes, stripe, bitacora,
            "http://localhost:4200, https://app.pidefacil.mx/");

    private static CustomUserDetails usuario(String rol) {
        return new CustomUserDetails(UUID.randomUUID(), "ana", "", rol, "/", RESTAURANTE, null, List.of());
    }

    private PagosLineaConfig conCuenta(EstadoCuenta estado) {
        PagosLineaConfig c = PagosLineaConfig.builder().restaurantId(RESTAURANTE)
                .stripeAccountId("acct_1ABCDEFG").estadoCuenta(estado).build();
        when(configs.findById(RESTAURANTE)).thenReturn(Optional.of(c));
        return c;
    }

    private static Account cuenta(boolean cobra, boolean datosEnviados, String razon, List<String> faltan) {
        Account a = new Account();
        a.setId("acct_1ABCDEFG");
        a.setChargesEnabled(cobra);
        a.setDetailsSubmitted(datosEnviados);
        Account.Requirements r = new Account.Requirements();
        r.setDisabledReason(razon);
        r.setCurrentlyDue(faltan);
        a.setRequirements(r);
        return a;
    }

    @Test
    @DisplayName("Solo el dueño configura los pagos en línea")
    void soloDueno() {
        assertThrows(ResponseStatusException.class, () -> servicio.estado(usuario("BRANCH_MANAGER")));
        assertThrows(ResponseStatusException.class, () -> servicio.conectar(usuario("CAJERO"), "http://localhost:4200"));
        assertThrows(ResponseStatusException.class, () -> servicio.ajustes(usuario("BRANCH_MANAGER"),
                new PagosLineaService.Ajustes(true, null, null, null)));
    }

    @Test
    @DisplayName("Conectar crea la cuenta una vez y regresa al panel; otra dirección de regreso se rechaza")
    void conectar() throws Exception {
        when(configs.findById(RESTAURANTE)).thenReturn(Optional.empty());
        Restaurant r = new Restaurant();
        r.setName("Tacos Ana");
        when(restaurantes.findById(RESTAURANTE)).thenReturn(Optional.of(r));
        when(stripe.crearCuenta(RESTAURANTE, "Tacos Ana")).thenReturn(cuenta(false, false, "requirements.past_due", List.of("x")));
        when(stripe.modoPrueba()).thenReturn(true);
        when(stripe.ligaDeAlta(any(), any(), any())).thenReturn("https://connect.stripe.com/setup/abc");

        assertThrows(IllegalArgumentException.class, () -> servicio.conectar(usuario("SUPER_ADMIN"), "https://malo.com"));
        verify(stripe, never()).crearCuenta(any(), any());

        assertEquals("https://connect.stripe.com/setup/abc", servicio.conectar(usuario("SUPER_ADMIN"), "https://app.pidefacil.mx"));
        verify(stripe).ligaDeAlta("acct_1ABCDEFG",
                "https://app.pidefacil.mx/settings/pagos-en-linea?stripe=renovar",
                "https://app.pidefacil.mx/settings/pagos-en-linea?stripe=regreso");
        verify(configs).save(argThat(c -> "acct_1ABCDEFG".equals(c.getStripeAccountId())
                && c.getEstadoCuenta() == EstadoCuenta.PENDIENTE && c.getModoPrueba()));
        verify(bitacora).anotar(eq(RESTAURANTE), eq(BitacoraPagosLinea.Accion.CONECTAR), contains("••••DEFG"), eq("ana"));

        // Ya tiene cuenta: solo otra liga, sin crear otra cuenta.
        conCuenta(EstadoCuenta.PENDIENTE);
        servicio.conectar(usuario("SUPER_ADMIN"), "http://localhost:4200/");
        verify(stripe, times(1)).crearCuenta(any(), any());
    }

    @Test
    @DisplayName("Lo que dice Stripe se traduce a: lista, pendiente o detenida")
    void estados() {
        PagosLineaConfig c = new PagosLineaConfig();
        PagosLineaService.aplicar(c, cuenta(true, true, null, List.of()));
        assertEquals(EstadoCuenta.LISTA, c.getEstadoCuenta());
        assertNull(c.getMotivoEstado());

        PagosLineaService.aplicar(c, cuenta(true, true, null, List.of("individual.id_number")));
        assertEquals(EstadoCuenta.LISTA, c.getEstadoCuenta());
        assertTrue(c.getMotivoEstado().contains("1 dato"));

        PagosLineaService.aplicar(c, cuenta(false, false, null, List.of()));
        assertEquals(EstadoCuenta.PENDIENTE, c.getEstadoCuenta());
        assertEquals("Falta terminar el alta en Stripe.", c.getMotivoEstado());

        PagosLineaService.aplicar(c, cuenta(false, true, "requirements.pending_verification", List.of()));
        assertEquals(EstadoCuenta.PENDIENTE, c.getEstadoCuenta());

        PagosLineaService.aplicar(c, cuenta(false, true, "rejected.fraud", List.of()));
        assertEquals(EstadoCuenta.DETENIDA, c.getEstadoCuenta());
        assertTrue(c.getMotivoEstado().contains("rechazó"));
    }

    @Test
    @DisplayName("Solo se activa con la cuenta lista, y con al menos una forma de pago")
    void activar() {
        conCuenta(EstadoCuenta.PENDIENTE);
        assertThrows(IllegalArgumentException.class, () -> servicio.ajustes(usuario("SUPER_ADMIN"),
                new PagosLineaService.Ajustes(true, null, null, null)));

        conCuenta(EstadoCuenta.LISTA);
        assertThrows(IllegalArgumentException.class, () -> servicio.ajustes(usuario("SUPER_ADMIN"),
                new PagosLineaService.Ajustes(null, false, false, false)));
        assertTrue(servicio.ajustes(usuario("SUPER_ADMIN"), new PagosLineaService.Ajustes(true, null, null, null)).activo());
        verify(bitacora).anotar(eq(RESTAURANTE), eq(BitacoraPagosLinea.Accion.ACTIVAR), any(), eq("ana"));
    }

    @Test
    @DisplayName("Si Stripe detiene la cuenta, se apaga el cobro en línea")
    void stripeDetiene() throws Exception {
        PagosLineaConfig c = conCuenta(EstadoCuenta.LISTA);
        c.setActivo(true);
        when(configs.findByStripeAccountId("acct_1ABCDEFG")).thenReturn(Optional.of(c));
        when(stripe.cuenta("acct_1ABCDEFG")).thenReturn(cuenta(false, true, "rejected.other", List.of()));

        servicio.actualizarCuenta("acct_1ABCDEFG");
        assertEquals(EstadoCuenta.DETENIDA, c.getEstadoCuenta());
        assertFalse(c.getActivo());
        verify(bitacora).anotar(eq(RESTAURANTE), eq(BitacoraPagosLinea.Accion.DESACTIVAR), any(), eq("Stripe"));
    }

    @Test
    @DisplayName("Un aviso de una cuenta que no es de nadie aquí no hace nada")
    void cuentaAjena() throws Exception {
        when(configs.findByStripeAccountId("acct_OTRA")).thenReturn(Optional.empty());
        servicio.actualizarCuenta("acct_OTRA");
        verify(stripe, never()).cuenta(any());
    }

    @Test
    @DisplayName("La comisión de Pide Fácil va de 0% a 30% y queda en la bitácora")
    void comision() {
        when(restaurantes.existsById(RESTAURANTE)).thenReturn(true);
        conCuenta(EstadoCuenta.LISTA);
        CustomUserDetails operador = usuario("SYSTEM_ADMIN");
        assertThrows(IllegalArgumentException.class, () -> servicio.fijarComision(RESTAURANTE, new BigDecimal("-1"), operador));
        assertThrows(IllegalArgumentException.class, () -> servicio.fijarComision(RESTAURANTE, new BigDecimal("30.5"), operador));
        assertEquals(new BigDecimal("2.50"), servicio.fijarComision(RESTAURANTE, new BigDecimal("2.5"), operador).comisionPlataformaPct());
        verify(bitacora).anotar(eq(RESTAURANTE), eq(BitacoraPagosLinea.Accion.COMISION), contains("0% → 2.5%"), eq("ana"));
    }
}
