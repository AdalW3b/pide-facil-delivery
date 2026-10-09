package com.omnirest.omnirest_backend.services.pagoslinea;

import com.omnirest.omnirest_backend.domain.entities.Branch;
import com.omnirest.omnirest_backend.domain.entities.Order;
import com.omnirest.omnirest_backend.domain.entities.Pago;
import com.omnirest.omnirest_backend.domain.entities.PagosLineaConfig;
import com.omnirest.omnirest_backend.domain.entities.PagosLineaConfig.EstadoCuenta;
import com.omnirest.omnirest_backend.domain.entities.Restaurant;
import com.omnirest.omnirest_backend.domain.entities.TransaccionLinea;
import com.omnirest.omnirest_backend.domain.entities.TransaccionLinea.Estado;
import com.omnirest.omnirest_backend.dtos.PagoEnLineaDTO;
import com.omnirest.omnirest_backend.repositories.OrderRepository;
import com.omnirest.omnirest_backend.repositories.PagoRepository;
import com.omnirest.omnirest_backend.repositories.PagosLineaConfigRepository;
import com.omnirest.omnirest_backend.repositories.TransaccionLineaRepository;
import com.stripe.model.BalanceTransaction;
import com.stripe.model.Charge;
import com.stripe.model.PaymentIntent;
import com.stripe.model.StripeError;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.transaction.PlatformTransactionManager;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** Cobro con tarjeta del menu en linea: formas de pago, inicio, lo que dice Stripe y vencimiento. */
class CobrosLineaServiceTest {

    private static final UUID RESTAURANTE = UUID.randomUUID();
    private static final String CUENTA = "acct_1REST";

    private final TransaccionLineaRepository transacciones = mock(TransaccionLineaRepository.class);
    private final PagosLineaConfigRepository configs = mock(PagosLineaConfigRepository.class);
    private final OrderRepository pedidos = mock(OrderRepository.class);
    private final PagoRepository pagos = mock(PagoRepository.class);
    private final StripeConnect stripe = mock(StripeConnect.class);
    private final ApplicationEventPublisher eventos = mock(ApplicationEventPublisher.class);
    private final CobrosLineaService servicio = new CobrosLineaService(transacciones, configs, pedidos, pagos, stripe,
            eventos, mock(PlatformTransactionManager.class));

    private PagosLineaConfig config;
    private Order pedido;

    @BeforeEach
    void preparar() {
        config = PagosLineaConfig.builder().restaurantId(RESTAURANTE).stripeAccountId(CUENTA)
                .estadoCuenta(EstadoCuenta.LISTA).activo(true).comisionPlataformaPct(new BigDecimal("2.5")).build();
        when(configs.findById(RESTAURANTE)).thenReturn(Optional.of(config));
        when(stripe.configurado()).thenReturn(true);
        when(stripe.llavePublica()).thenReturn("pk_test_123");
        when(transacciones.save(any())).thenAnswer(i -> {
            TransaccionLinea t = i.getArgument(0);
            if (t.getId() == null) t.setId(UUID.randomUUID());
            return t;
        });

        Restaurant r = new Restaurant();
        r.setId(RESTAURANTE);
        Branch b = new Branch();
        b.setId(UUID.randomUUID());
        b.setName("Centro");
        b.setRestaurant(r);
        pedido = Order.builder().id(UUID.randomUUID()).branch(b).turno("A-12").esperandoPagoLinea(true).build();
        when(pedidos.findById(pedido.getId())).thenReturn(Optional.of(pedido));
    }

    private TransaccionLinea transaccion(Estado estado) {
        return TransaccionLinea.builder().id(UUID.randomUUID()).restaurantId(RESTAURANTE)
                .branchId(pedido.getBranch().getId()).orderId(pedido.getId()).stripeAccountId(CUENTA)
                .paymentIntentId("pi_1").claveIdempotencia("pedido-" + pedido.getId()).estado(estado)
                .monto(new BigDecimal("250.00")).propina(new BigDecimal("20.00"))
                .expiraEn(LocalDateTime.now().minusMinutes(1)).actualizadoEn(LocalDateTime.now().minusMinutes(5)).build();
    }

    private static PaymentIntent intent(String estado) {
        PaymentIntent pi = new PaymentIntent();
        pi.setId("pi_1");
        pi.setStatus(estado);
        pi.setClientSecret("pi_1_secret_x");
        return pi;
    }

    @Test
    @DisplayName("La tarjeta solo se ofrece con la cuenta lista, el cobro activado y las llaves puestas")
    void formas() {
        assertTrue(servicio.formas(RESTAURANTE).tarjeta());
        config.setActivo(false);
        CobrosLineaService.Formas f = servicio.formas(RESTAURANTE);
        assertFalse(f.tarjeta());
        assertThrows(IllegalStateException.class, () -> servicio.exigirForma(RESTAURANTE, "TARJETA", false));

        // Sin tarjeta nunca se queda el cliente sin como pagar, aunque el dueño haya apagado el efectivo.
        config.setAceptaEfectivo(false);
        assertTrue(servicio.formas(RESTAURANTE).efectivo());

        config.setActivo(true);
        assertThrows(IllegalStateException.class, () -> servicio.exigirForma(RESTAURANTE, "EFECTIVO", false));
        assertTrue(servicio.exigirForma(RESTAURANTE, "TARJETA", false));
        assertFalse(servicio.exigirForma(RESTAURANTE, "TIENDA", true));

        when(stripe.llavePublica()).thenReturn(null);
        assertFalse(servicio.formas(RESTAURANTE).tarjeta());
    }

    @Test
    @DisplayName("Iniciar crea el cobro en la cuenta del restaurante con su comisión e idempotencia")
    void iniciar() throws Exception {
        when(stripe.crearCobro(eq(CUENTA), eq(25000L), eq(625L), contains("A-12"), anyMap(), eq("pedido-" + pedido.getId())))
                .thenReturn(intent("requires_payment_method"));

        PagoEnLineaDTO pago = servicio.iniciar(pedido, new BigDecimal("250"), new BigDecimal("20"), "+52 55 1234 5678");
        assertEquals("pi_1_secret_x", pago.clientSecret());
        assertEquals("pk_test_123", pago.llavePublica());
        assertEquals(CUENTA, pago.cuenta());
        verify(transacciones).save(argThat(t -> "pi_1".equals(t.getPaymentIntentId())
                && t.getComisionPlataforma().compareTo(new BigDecimal("6.25")) == 0
                && "••••5678".equals(t.getClienteRef()) && t.getEstado() == Estado.PENDIENTE));

        assertThrows(IllegalArgumentException.class, () -> servicio.iniciar(pedido, new BigDecimal("9.99"), null, null));
    }

    @Test
    @DisplayName("Pagado: queda el pago sin turno de caja, el pedido deja de esperar y se avisa una sola vez")
    void pagado() {
        TransaccionLinea t = transaccion(Estado.PENDIENTE);
        PaymentIntent pi = intent("succeeded");
        Charge cargo = new Charge();
        Charge.PaymentMethodDetails detalles = new Charge.PaymentMethodDetails();
        Charge.PaymentMethodDetails.Card tarjeta = new Charge.PaymentMethodDetails.Card();
        tarjeta.setBrand("visa");
        tarjeta.setLast4("4242");
        detalles.setCard(tarjeta);
        cargo.setPaymentMethodDetails(detalles);
        BalanceTransaction bt = new BalanceTransaction();
        BalanceTransaction.FeeDetail stripeFee = new BalanceTransaction.FeeDetail();
        stripeFee.setType("stripe_fee");
        stripeFee.setAmount(1250L);
        BalanceTransaction.FeeDetail appFee = new BalanceTransaction.FeeDetail();
        appFee.setType("application_fee");
        appFee.setAmount(625L);
        bt.setFeeDetails(List.of(stripeFee, appFee));
        cargo.setBalanceTransactionObject(bt);
        pi.setLatestChargeObject(cargo);

        servicio.aplicar(t, pi);
        assertEquals(Estado.PAGADO, t.getEstado());
        assertEquals("4242", t.getUltimos4());
        assertEquals(0, t.getComisionStripe().compareTo(new BigDecimal("12.50")));
        assertFalse(pedido.getEsperandoPagoLinea());
        assertTrue(pedido.getPagadoEnLinea());
        verify(pagos).save(argThat((Pago p) -> p.getTurnoId() == null && !p.getEsEfectivo()
                && p.getMonto().compareTo(new BigDecimal("230.00")) == 0 && p.getPropina().compareTo(new BigDecimal("20.00")) == 0
                && t.getId().equals(p.getTransaccionLineaId())));
        verify(eventos).publishEvent(new PagoLineaResuelto(pedido.getId(), pedido.getBranch().getId(), true));

        // Stripe lo vuelve a avisar: no se registra dos veces.
        servicio.aplicar(t, pi);
        verify(pagos, times(1)).save(any());
    }

    @Test
    @DisplayName("Rechazada: queda FALLIDO con el motivo en español y se puede reintentar")
    void rechazada() {
        TransaccionLinea t = transaccion(Estado.PENDIENTE);
        PaymentIntent pi = intent("requires_payment_method");
        StripeError e = new StripeError();
        e.setCode("card_declined");
        e.setDeclineCode("insufficient_funds");
        pi.setLastPaymentError(e);

        servicio.aplicar(t, pi);
        assertEquals(Estado.FALLIDO, t.getEstado());
        assertTrue(t.getError().contains("fondos"));
        verifyNoInteractions(eventos);

        servicio.aplicar(t, intent("succeeded"));
        assertEquals(Estado.PAGADO, t.getEstado());
    }

    @Test
    @DisplayName("A los 20 minutos sin pagar se cancela en Stripe y el pedido también")
    void vencer() throws Exception {
        TransaccionLinea t = transaccion(Estado.PENDIENTE);
        when(transacciones.findTop50ByEstadoInAndExpiraEnBeforeOrderByExpiraEnAsc(any(), any())).thenReturn(List.of(t));
        when(transacciones.bloquear(t.getId())).thenReturn(Optional.of(t));
        when(stripe.cobro(CUENTA, "pi_1")).thenReturn(intent("requires_payment_method"));

        servicio.vencer();
        verify(stripe).cancelarCobro(CUENTA, "pi_1");
        assertEquals(Estado.CANCELADO, t.getEstado());
        verify(eventos).publishEvent(new PagoLineaResuelto(pedido.getId(), pedido.getBranch().getId(), false));
    }

    @Test
    @DisplayName("Si se pagó justo antes de vencer, se respeta el pago")
    void pagoAlUltimo() throws Exception {
        TransaccionLinea t = transaccion(Estado.PENDIENTE);
        when(transacciones.findTop50ByEstadoInAndExpiraEnBeforeOrderByExpiraEnAsc(any(), any())).thenReturn(List.of(t));
        when(transacciones.bloquear(t.getId())).thenReturn(Optional.of(t));
        when(stripe.cobro(CUENTA, "pi_1")).thenReturn(intent("succeeded"));

        servicio.vencer();
        verify(stripe, never()).cancelarCobro(any(), any());
        assertEquals(Estado.PAGADO, t.getEstado());
    }

    @Test
    @DisplayName("Un aviso que llega desde otra cuenta no toca el cobro")
    void otraCuenta() throws Exception {
        TransaccionLinea t = transaccion(Estado.PENDIENTE);
        when(transacciones.findByPaymentIntentId("pi_1")).thenReturn(Optional.of(t));
        servicio.alAvisoDeStripe("acct_OTRA", "pi_1");
        verify(stripe, never()).cobro(any(), any());
        assertEquals(Estado.PENDIENTE, t.getEstado());
    }

    @Test
    @DisplayName("La comisión de Pide Fácil se redondea al centavo")
    void comision() {
        assertEquals(new BigDecimal("0.00"), CobrosLineaService.comision(new BigDecimal("199.90"), BigDecimal.ZERO));
        assertEquals(new BigDecimal("5.00"), CobrosLineaService.comision(new BigDecimal("199.90"), new BigDecimal("2.5")));
        assertEquals(19990L, CobrosLineaService.centavos(new BigDecimal("199.90")));
    }
}
