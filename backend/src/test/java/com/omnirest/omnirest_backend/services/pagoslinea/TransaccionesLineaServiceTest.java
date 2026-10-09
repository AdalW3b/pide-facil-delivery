package com.omnirest.omnirest_backend.services.pagoslinea;

import com.omnirest.omnirest_backend.domain.entities.ReembolsoLinea;
import com.omnirest.omnirest_backend.domain.entities.TransaccionLinea;
import com.omnirest.omnirest_backend.domain.entities.TransaccionLinea.Estado;
import com.omnirest.omnirest_backend.repositories.BranchRepository;
import com.omnirest.omnirest_backend.repositories.OrderRepository;
import com.omnirest.omnirest_backend.repositories.ReembolsoLineaRepository;
import com.omnirest.omnirest_backend.repositories.TransaccionLineaRepository;
import com.omnirest.omnirest_backend.security.CustomUserDetails;
import com.stripe.model.Refund;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** Devoluciones de pagos en linea: quien puede, cuanto y lo que llega de Stripe. */
class TransaccionesLineaServiceTest {

    private static final UUID RESTAURANTE = UUID.randomUUID();
    private static final String CUENTA = "acct_1REST";

    private final TransaccionLineaRepository transacciones = mock(TransaccionLineaRepository.class);
    private final ReembolsoLineaRepository reembolsos = mock(ReembolsoLineaRepository.class);
    private final OrderRepository pedidos = mock(OrderRepository.class);
    private final StripeConnect stripe = mock(StripeConnect.class);
    private final BitacoraPagosLinea bitacora = mock(BitacoraPagosLinea.class);
    private final TransaccionesLineaService servicio = new TransaccionesLineaService(transacciones, reembolsos, pedidos,
            mock(BranchRepository.class), stripe, bitacora);

    private TransaccionLinea t;

    @BeforeEach
    void preparar() {
        ReflectionTestUtils.setField(servicio, "em", mock(EntityManager.class));
        t = TransaccionLinea.builder().id(UUID.randomUUID()).restaurantId(RESTAURANTE).branchId(UUID.randomUUID())
                .orderId(UUID.randomUUID()).stripeAccountId(CUENTA).paymentIntentId("pi_1").claveIdempotencia("x")
                .estado(Estado.PAGADO).monto(new BigDecimal("300.00")).build();
        when(transacciones.findById(t.getId())).thenReturn(Optional.of(t));
        when(reembolsos.save(any())).thenAnswer(i -> {
            ReembolsoLinea r = i.getArgument(0);
            if (r.getId() == null) r.setId(UUID.randomUUID());
            return r;
        });
    }

    private static CustomUserDetails usuario(String rol) {
        return new CustomUserDetails(UUID.randomUUID(), "ana", "", rol, "/", RESTAURANTE, null, List.of());
    }

    private static Refund refund(String id, long centavos, String estado) {
        Refund r = new Refund();
        r.setId(id);
        r.setAmount(centavos);
        r.setStatus(estado);
        return r;
    }

    @Test
    @DisplayName("Devolver una parte y luego el resto: parcial y después devuelto")
    void parcialYTotal() throws Exception {
        when(stripe.reembolsar(eq(CUENTA), eq("pi_1"), anyLong(), any(), any())).thenReturn(refund("re_1", 10000, "succeeded"));

        servicio.reembolsar(usuario("BRANCH_MANAGER"), t.getId(), new TransaccionesLineaService.PedirReembolso(new BigDecimal("100"), "Faltó un platillo"));
        assertEquals(Estado.REEMBOLSO_PARCIAL, t.getEstado());
        verify(stripe).reembolsar(eq(CUENTA), eq("pi_1"), eq(10000L), eq("Faltó un platillo"), startsWith("reembolso-"));

        assertThrows(IllegalArgumentException.class, () -> servicio.reembolsar(usuario("SUPER_ADMIN"), t.getId(),
                new TransaccionesLineaService.PedirReembolso(new BigDecimal("200.01"), null)));

        servicio.reembolsar(usuario("SUPER_ADMIN"), t.getId(), new TransaccionesLineaService.PedirReembolso(null, null));
        verify(stripe).reembolsar(eq(CUENTA), eq("pi_1"), eq(20000L), any(), any());
        assertEquals(Estado.REEMBOLSADO, t.getEstado());
        assertEquals(0, t.getMontoReembolsado().compareTo(new BigDecimal("300.00")));
        verify(bitacora, times(2)).anotar(eq(RESTAURANTE), eq(BitacoraPagosLinea.Accion.REEMBOLSO), any(), eq("ana"));

        assertThrows(IllegalStateException.class, () -> servicio.reembolsar(usuario("SUPER_ADMIN"), t.getId(),
                new TransaccionesLineaService.PedirReembolso(null, null)));
    }

    @Test
    @DisplayName("Solo el dueño o el gerente devuelven; de otro restaurante no se ve")
    void permisos() {
        assertThrows(ResponseStatusException.class, () -> servicio.reembolsar(usuario("MESERO"), t.getId(),
                new TransaccionesLineaService.PedirReembolso(null, null)));
        t.setRestaurantId(UUID.randomUUID());
        assertThrows(ResponseStatusException.class, () -> servicio.detalle(usuario("SUPER_ADMIN"), t.getId()));
    }

    @Test
    @DisplayName("Una devolución hecha en el panel de Stripe queda registrada una sola vez")
    void desdeStripe() throws Exception {
        when(transacciones.findByPaymentIntentId("pi_1")).thenReturn(Optional.of(t));
        when(stripe.reembolsos(CUENTA, "pi_1")).thenReturn(List.of(refund("re_9", 5000, "succeeded")));
        when(reembolsos.findByStripeRefundId("re_9")).thenReturn(Optional.empty(), Optional.of(new ReembolsoLinea()));

        servicio.sincronizarReembolsos(CUENTA, "pi_1");
        servicio.sincronizarReembolsos(CUENTA, "pi_1");
        assertEquals(Estado.REEMBOLSO_PARCIAL, t.getEstado());
        assertEquals(0, t.getMontoReembolsado().compareTo(new BigDecimal("50.00")));

        // Desde otra cuenta no se toca.
        servicio.sincronizarReembolsos("acct_OTRA", "pi_1");
        verify(stripe, times(2)).reembolsos(any(), any());
    }
}
