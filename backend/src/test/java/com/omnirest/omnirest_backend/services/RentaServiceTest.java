package com.omnirest.omnirest_backend.services;

import com.omnirest.omnirest_backend.domain.entities.CobroSuscripcion;
import com.omnirest.omnirest_backend.domain.entities.Restaurant;
import com.omnirest.omnirest_backend.repositories.CobroSuscripcionRepository;
import com.omnirest.omnirest_backend.repositories.RestaurantRepository;
import com.omnirest.omnirest_backend.security.CustomUserDetails;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** La renta: Stripe sin duplicados, efectivo con su periodo y quién está vencido. */
class RentaServiceTest {

    private final UUID restaurantId = UUID.randomUUID();
    private final Restaurant restaurante = Restaurant.builder().id(restaurantId).name("Pizzería")
            .subscriptionPlan("PRO").subscriptionStatus("ACTIVE").active(true).isDemo(false).build();
    private final CustomUserDetails operador = new CustomUserDetails(UUID.randomUUID(), "sysadmin", "x", "SYSTEM_ADMIN",
            "/system", null, null, List.of());

    private final CobroSuscripcionRepository cobroRepository = mock(CobroSuscripcionRepository.class);
    private final RestaurantRepository restaurantRepository = mock(RestaurantRepository.class);
    private final AvisosSistemaService avisos = mock(AvisosSistemaService.class);
    private final RentaService servicio = new RentaService(cobroRepository, restaurantRepository, avisos);

    @BeforeEach
    void setUp() {
        when(restaurantRepository.findById(restaurantId)).thenReturn(Optional.of(restaurante));
        when(cobroRepository.save(any(CobroSuscripcion.class))).thenAnswer(i -> i.getArgument(0));
    }

    @Test
    @DisplayName("Factura pagada de Stripe: queda en el historial, activa la cuenta y avisa al dueño")
    void stripePagada() {
        restaurante.setSubscriptionStatus("PAST_DUE");
        servicio.registrarStripe(restaurantId, "in_123", true, new BigDecimal("599"), "mxn",
                LocalDate.of(2026, 10, 1), LocalDate.of(2026, 11, 1));

        ArgumentCaptor<CobroSuscripcion> captor = ArgumentCaptor.forClass(CobroSuscripcion.class);
        verify(cobroRepository).save(captor.capture());
        CobroSuscripcion c = captor.getValue();
        assertEquals(CobroSuscripcion.Estado.PAGADO, c.getEstado());
        assertEquals(new BigDecimal("599.00"), c.getMonto());
        assertEquals("MXN", c.getMoneda());
        assertEquals("in_123", c.getReferencia());
        assertEquals("ACTIVE", restaurante.getSubscriptionStatus());
        verify(avisos).avisar(eq(restaurantId), eq("RENTA"), anyString(), anyString());
    }

    @Test
    @DisplayName("El mismo aviso de Stripe dos veces no registra dos cobros")
    void stripeIdempotente() {
        when(cobroRepository.existsByMetodoAndReferenciaAndEstado(CobroSuscripcion.Metodo.STRIPE, "in_123",
                CobroSuscripcion.Estado.PAGADO)).thenReturn(true);
        servicio.registrarStripe(restaurantId, "in_123", true, new BigDecimal("599"), "mxn", null, null);
        verify(cobroRepository, never()).save(any());
    }

    @Test
    @DisplayName("Cobro fallido: queda registrado y la cuenta pasa a vencida")
    void stripeFallida() {
        servicio.registrarStripe(restaurantId, "in_456", false, new BigDecimal("599"), "mxn", null, null);
        assertEquals("PAST_DUE", restaurante.getSubscriptionStatus());
        verify(avisos).avisar(eq(restaurantId), eq("RENTA"), contains("No pudimos"), anyString());
    }

    @Test
    @DisplayName("Efectivo: pide monto y periodo, y lo registra el operador")
    void efectivo() {
        assertThrows(ResponseStatusException.class, () -> servicio.registrarEfectivo(operador,
                new RentaService.NuevoPagoEfectivo(restaurantId, BigDecimal.ZERO, LocalDate.now(), LocalDate.now(), null, null, null)));
        assertThrows(ResponseStatusException.class, () -> servicio.registrarEfectivo(operador,
                new RentaService.NuevoPagoEfectivo(restaurantId, new BigDecimal("599"), LocalDate.of(2026, 11, 1),
                        LocalDate.of(2026, 10, 1), null, null, null)), "el periodo no puede ir al revés");

        RentaService.CobroDTO c = servicio.registrarEfectivo(operador, new RentaService.NuevoPagoEfectivo(restaurantId,
                new BigDecimal("599"), LocalDate.of(2026, 10, 1), LocalDate.of(2026, 10, 31), null, " R-001 ", null));
        assertEquals("EFECTIVO", c.metodo());
        assertEquals("R-001", c.referencia());
        assertEquals("sysadmin", c.registradoPor());
        assertEquals("PRO", c.plan(), "toma el plan del restaurante");
    }

    @Test
    @DisplayName("Un cobro se anula con motivo, no se borra; los de Stripe no se anulan aquí")
    void anular() {
        CobroSuscripcion efectivo = CobroSuscripcion.builder().id(UUID.randomUUID()).restaurantId(restaurantId)
                .metodo(CobroSuscripcion.Metodo.EFECTIVO).estado(CobroSuscripcion.Estado.PAGADO).monto(BigDecimal.TEN).build();
        CobroSuscripcion stripe = CobroSuscripcion.builder().id(UUID.randomUUID()).restaurantId(restaurantId)
                .metodo(CobroSuscripcion.Metodo.STRIPE).estado(CobroSuscripcion.Estado.PAGADO).monto(BigDecimal.TEN).build();
        when(cobroRepository.findById(efectivo.getId())).thenReturn(Optional.of(efectivo));
        when(cobroRepository.findById(stripe.getId())).thenReturn(Optional.of(stripe));

        assertThrows(ResponseStatusException.class, () -> servicio.anular(operador, efectivo.getId(), "  "));
        assertEquals("ANULADO", servicio.anular(operador, efectivo.getId(), "Se capturó dos veces").estado());
        assertThrows(ResponseStatusException.class, () -> servicio.anular(operador, stripe.getId(), "x"));
    }

    @Test
    @DisplayName("Vencido: lo pagado ya no cubre hoy, o terminó la prueba sin pagar; la demo nunca")
    void vencidos() {
        LocalDate hoy = LocalDate.of(2026, 10, 15);
        CobroSuscripcion cubreHastaAyer = CobroSuscripcion.builder().estado(CobroSuscripcion.Estado.PAGADO)
                .monto(BigDecimal.TEN).periodoHasta(hoy.minusDays(1)).pagadoEn(LocalDateTime.of(2026, 9, 14, 10, 0)).build();
        CobroSuscripcion cubreElMes = CobroSuscripcion.builder().estado(CobroSuscripcion.Estado.PAGADO)
                .monto(BigDecimal.TEN).periodoHasta(hoy.plusDays(10)).pagadoEn(LocalDateTime.of(2026, 10, 1, 10, 0)).build();

        assertTrue(RentaService.estadoDe(restaurante, List.of(cubreHastaAyer), hoy).vencido());
        assertFalse(RentaService.estadoDe(restaurante, List.of(cubreHastaAyer, cubreElMes), hoy).vencido());
        assertEquals(hoy.plusDays(10), RentaService.estadoDe(restaurante, List.of(cubreHastaAyer, cubreElMes), hoy).pagadoHasta());

        restaurante.setTrialEndsAt(hoy.minusDays(2).atStartOfDay());
        assertTrue(RentaService.estadoDe(restaurante, List.of(), hoy).vencido(), "prueba terminada sin pagar");
        restaurante.setTrialEndsAt(hoy.plusDays(3).atStartOfDay());
        assertFalse(RentaService.estadoDe(restaurante, List.of(), hoy).vencido(), "sigue en prueba");

        restaurante.setIsDemo(true);
        assertFalse(RentaService.estadoDe(restaurante, List.of(cubreHastaAyer), hoy).vencido(), "la demo no paga");
    }
}
