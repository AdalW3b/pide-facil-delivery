package com.omnirest.omnirest_backend.services;

import com.omnirest.omnirest_backend.domain.entities.*;
import com.omnirest.omnirest_backend.domain.enums.OrderStatus;
import com.omnirest.omnirest_backend.domain.enums.OrderType;
import com.omnirest.omnirest_backend.dtos.BillSummaryDTO;
import com.omnirest.omnirest_backend.dtos.CajaDTOs;
import com.omnirest.omnirest_backend.repositories.*;
import com.omnirest.omnirest_backend.security.CustomUserDetails;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** Cobrar cuentas y cerrar la caja a ciegas. */
class CajaServiceTest {

    private final UUID branchId = UUID.randomUUID();
    private final Branch sucursal = Branch.builder().id(branchId).build();
    private final CustomUserDetails cajera = new CustomUserDetails(UUID.randomUUID(), "lupita", "x", "BRANCH_MANAGER",
            "/", UUID.randomUUID(), branchId, List.of());

    private final PaymentMethod efectivo = PaymentMethod.builder().id(UUID.randomUUID()).branch(sucursal)
            .name("Efectivo").active(true).esEfectivo(true).build();
    private final PaymentMethod tarjeta = PaymentMethod.builder().id(UUID.randomUUID()).branch(sucursal)
            .name("Tarjeta").active(true).esEfectivo(false).build();

    private final TurnoCajaRepository turnoRepository = mock(TurnoCajaRepository.class);
    private final PagoRepository pagoRepository = mock(PagoRepository.class);
    private final MovimientoCajaRepository movimientoRepository = mock(MovimientoCajaRepository.class);
    private final CorteRepartidorRepository corteRepository = mock(CorteRepartidorRepository.class);
    private final PaymentMethodRepository paymentMethodRepository = mock(PaymentMethodRepository.class);
    private final OrderRepository orderRepository = mock(OrderRepository.class);
    private final OrderService orderService = mock(OrderService.class);

    private CajaService servicio;
    private TurnoCaja turno;
    private Order cuenta;
    private final List<Pago> pagosGuardados = new ArrayList<>();

    @BeforeEach
    void setUp() {
        servicio = new CajaService(turnoRepository, pagoRepository, movimientoRepository, corteRepository,
                paymentMethodRepository, orderRepository, orderService);

        turno = TurnoCaja.builder().id(UUID.randomUUID()).branchId(branchId).abiertoPorNombre("lupita")
                .abiertoEn(LocalDateTime.now().minusHours(6)).fondoInicial(new BigDecimal("500.00")).build();
        when(turnoRepository.findByBranchIdAndCerradoEnIsNull(branchId)).thenAnswer(i ->
                turno.abierto() ? Optional.of(turno) : Optional.empty());
        when(turnoRepository.save(any(TurnoCaja.class))).thenAnswer(i -> i.getArgument(0));

        cuenta = Order.builder().id(UUID.randomUUID()).branch(sucursal).status(OrderStatus.OPEN)
                .orderType(OrderType.SALON).build();
        when(orderRepository.findById(cuenta.getId())).thenReturn(Optional.of(cuenta));
        totalDeLaCuenta("350.00");
        when(pagoRepository.pagadoDe(any())).thenReturn(BigDecimal.ZERO);

        when(paymentMethodRepository.findById(efectivo.getId())).thenReturn(Optional.of(efectivo));
        when(paymentMethodRepository.findById(tarjeta.getId())).thenReturn(Optional.of(tarjeta));
        when(paymentMethodRepository.findByBranchId(branchId)).thenReturn(List.of(tarjeta, efectivo));
        when(pagoRepository.saveAll(anyList())).thenAnswer(i -> {
            pagosGuardados.addAll(i.getArgument(0));
            return i.getArgument(0);
        });
        when(pagoRepository.save(any(Pago.class))).thenAnswer(i -> {
            pagosGuardados.add(i.getArgument(0));
            return i.getArgument(0);
        });
    }

    private void totalDeLaCuenta(String total) {
        when(orderService.getBill(branchId, cuenta.getId())).thenReturn(
                new BillSummaryDTO(cuenta.getId(), 4, List.of(), new BigDecimal(total), "", null, null));
    }

    private static CajaDTOs.PagoPeticion pago(PaymentMethod m, String monto, String propina, String recibido) {
        return new CajaDTOs.PagoPeticion(m.getId(), new BigDecimal(monto),
                propina != null ? new BigDecimal(propina) : null, recibido != null ? new BigDecimal(recibido) : null);
    }

    // ------------------------------------------------------------------
    // Cobro
    // ------------------------------------------------------------------

    @Test
    @DisplayName("Cobra con tarjeta y efectivo: calcula el cambio y cierra la mesa")
    void cobroMixto() {
        CajaDTOs.CobroResultado r = servicio.cobrar(branchId, cuenta.getId(), List.of(
                pago(tarjeta, "200", "20", null),
                pago(efectivo, "150", "10", "200")), cajera);

        assertEquals(2, pagosGuardados.size());
        Pago enEfectivo = pagosGuardados.get(1);
        assertTrue(enEfectivo.getEsEfectivo());
        assertEquals(new BigDecimal("40.00"), enEfectivo.getCambio(), "200 - (150 + 10)");
        assertEquals("Efectivo", enEfectivo.getMetodo());
        assertEquals(turno.getId(), enEfectivo.getTurnoId());
        assertEquals("lupita", enEfectivo.getCobradoPor());
        assertNull(pagosGuardados.get(0).getCambio(), "la tarjeta no da cambio");
        assertEquals(new BigDecimal("30.00"), r.propinas());
        assertEquals(new BigDecimal("40.00"), r.cambio());
        verify(orderService).closeOrder(branchId, cuenta.getId());
    }

    @Test
    @DisplayName("Si los pagos no suman la cuenta, no se guarda nada ni se cierra")
    void sumaQueNoCuadra() {
        IllegalArgumentException e = assertThrows(IllegalArgumentException.class, () ->
                servicio.cobrar(branchId, cuenta.getId(), List.of(pago(tarjeta, "300", null, null)), cajera));
        assertTrue(e.getMessage().contains("$300.00") && e.getMessage().contains("$350.00"), e.getMessage());
        assertTrue(pagosGuardados.isEmpty());
        verify(orderService, never()).closeOrder(any(), any());
    }

    @Test
    @DisplayName("En efectivo, lo recibido tiene que alcanzar")
    void efectivoQueNoAlcanza() {
        assertThrows(IllegalArgumentException.class, () ->
                servicio.cobrar(branchId, cuenta.getId(), List.of(pago(efectivo, "350", "0", "300")), cajera));
        verify(orderService, never()).closeOrder(any(), any());
    }

    @Test
    @DisplayName("Con la caja cerrada no se cobra")
    void cajaCerrada() {
        turno.setCerradoEn(LocalDateTime.now());
        IllegalStateException e = assertThrows(IllegalStateException.class, () ->
                servicio.cobrar(branchId, cuenta.getId(), List.of(pago(efectivo, "350", null, null)), cajera));
        assertTrue(e.getMessage().contains("caja está cerrada"));
    }

    @Test
    @DisplayName("Un método de otra sucursal o desactivado no sirve para cobrar")
    void metodoInvalido() {
        PaymentMethod ajeno = PaymentMethod.builder().id(UUID.randomUUID())
                .branch(Branch.builder().id(UUID.randomUUID()).build()).name("Vales").active(true).esEfectivo(false).build();
        when(paymentMethodRepository.findById(ajeno.getId())).thenReturn(Optional.of(ajeno));
        assertThrows(IllegalArgumentException.class, () ->
                servicio.cobrar(branchId, cuenta.getId(), List.of(pago(ajeno, "350", null, null)), cajera));

        tarjeta.setActive(false);
        assertThrows(IllegalArgumentException.class, () ->
                servicio.cobrar(branchId, cuenta.getId(), List.of(pago(tarjeta, "350", null, null)), cajera));
    }

    @Test
    @DisplayName("Una cuenta en cero se cierra sin pagos")
    void cuentaEnCero() {
        totalDeLaCuenta("0");
        servicio.cobrar(branchId, cuenta.getId(), List.of(), cajera);
        assertTrue(pagosGuardados.isEmpty());
        verify(orderService).closeOrder(branchId, cuenta.getId());
    }

    @Test
    @DisplayName("Los pedidos a domicilio no se cobran aquí")
    void domicilioNo() {
        cuenta.setOrderType(OrderType.DOMICILIO);
        assertThrows(IllegalStateException.class, () ->
                servicio.cobrar(branchId, cuenta.getId(), List.of(pago(efectivo, "350", null, null)), cajera));
    }

    @Test
    @DisplayName("Para llevar entregado en mostrador: entra como efectivo, una sola vez")
    void paraLlevarEnEfectivo() {
        Order paraLlevar = Order.builder().id(UUID.randomUUID()).branch(sucursal).orderType(OrderType.PARA_LLEVAR)
                .totalAmount(new BigDecimal("120")).build();

        servicio.cobrarEnEfectivoAlEntregar(paraLlevar);
        assertEquals(1, pagosGuardados.size());
        assertEquals(efectivo.getId(), pagosGuardados.get(0).getPaymentMethodId());
        assertEquals(new BigDecimal("120.00"), pagosGuardados.get(0).getMonto());

        when(pagoRepository.pagadoDe(paraLlevar.getId())).thenReturn(new BigDecimal("120"));
        servicio.cobrarEnEfectivoAlEntregar(paraLlevar);
        assertEquals(1, pagosGuardados.size(), "no se cobra dos veces");
    }

    // ------------------------------------------------------------------
    // Apertura y cierre
    // ------------------------------------------------------------------

    @Test
    @DisplayName("No se abren dos cajas a la vez")
    void unaCajaALaVez() {
        IllegalStateException e = assertThrows(IllegalStateException.class,
                () -> servicio.abrir(branchId, new BigDecimal("500"), cajera));
        assertTrue(e.getMessage().contains("ya está abierta"));
    }

    @Test
    @DisplayName("Mientras está abierta no se ve el arqueo: se cuenta a ciegas")
    void arqueoACiegas() {
        when(turnoRepository.findByIdAndBranchId(turno.getId(), branchId)).thenReturn(Optional.of(turno));
        assertThrows(IllegalStateException.class, () -> servicio.arqueo(branchId, turno.getId()));
    }

    @Test
    @DisplayName("Al cerrar calcula el esperado con todo lo del turno y congela la diferencia")
    void cierre() {
        when(pagoRepository.findByTurnoIdOrderByCreadoEnAsc(turno.getId())).thenReturn(List.of(
                Pago.builder().orderId(UUID.randomUUID()).metodo("Efectivo").esEfectivo(true)
                        .monto(new BigDecimal("300")).propina(new BigDecimal("20")).build(),
                Pago.builder().orderId(UUID.randomUUID()).metodo("Tarjeta").esEfectivo(false)
                        .monto(new BigDecimal("800")).propina(new BigDecimal("80")).build()));
        when(movimientoRepository.findByTurnoIdOrderByCreadoEnAsc(turno.getId())).thenReturn(List.of(
                MovimientoCaja.builder().tipo(MovimientoCaja.Tipo.ENTRADA).monto(new BigDecimal("100")).concepto("Cambio").build(),
                MovimientoCaja.builder().tipo(MovimientoCaja.Tipo.SALIDA).monto(new BigDecimal("50")).concepto("Gas").build()));
        when(corteRepository.findByTurnoIdOrderByCreadoEnAsc(turno.getId())).thenReturn(List.of(
                CorteRepartidor.builder().id(UUID.randomUUID()).entregas(4).recibido(new BigDecimal("400")).build()));

        // 500 + 300 + 20 + 100 - 50 + 400 = 1270; se cuentan 1260: faltan 10.
        CajaDTOs.Arqueo a = servicio.cerrar(branchId,
                new CajaDTOs.CerrarCaja(Map.of("500", 2, "200", 1, "50", 1, "10", 1), null, "  "), cajera);

        assertEquals(new BigDecimal("1270.00"), a.efectivoEsperado());
        assertEquals(new BigDecimal("1260.00"), a.efectivoContado());
        assertEquals(new BigDecimal("-10.00"), a.diferencia());
        assertEquals(0, new BigDecimal("1100").compareTo(a.totalVentas()));
        assertEquals(0, new BigDecimal("100").compareTo(a.totalPropinas()));
        assertEquals(2, a.ventasPorMetodo().size());
        assertEquals(0, new BigDecimal("400").compareTo(a.totalCortes()));
        assertNull(a.notas(), "nota en blanco = sin nota");

        assertFalse(turno.abierto());
        assertEquals("lupita", turno.getCerradoPorNombre());
        assertEquals(new BigDecimal("1270.00"), turno.getEfectivoEsperado());
        assertEquals(4, turno.getConteo().size());
    }

    @Test
    @DisplayName("Se puede cerrar capturando solo el total; sin nada no se cierra")
    void cierrePorTotal() {
        when(pagoRepository.findByTurnoIdOrderByCreadoEnAsc(any())).thenReturn(List.of());
        when(movimientoRepository.findByTurnoIdOrderByCreadoEnAsc(any())).thenReturn(List.of());
        when(corteRepository.findByTurnoIdOrderByCreadoEnAsc(any())).thenReturn(List.of());

        assertThrows(IllegalArgumentException.class,
                () -> servicio.cerrar(branchId, new CajaDTOs.CerrarCaja(null, null, null), cajera));

        CajaDTOs.Arqueo a = servicio.cerrar(branchId,
                new CajaDTOs.CerrarCaja(null, new BigDecimal("520"), "Sobró de una propina"), cajera);
        assertEquals(new BigDecimal("20.00"), a.diferencia());
        assertNull(turno.getConteo());
    }

    @Test
    @DisplayName("Retiros y entradas solo con la caja abierta")
    void movimientos() {
        when(movimientoRepository.save(any())).thenAnswer(i -> i.getArgument(0));
        CajaDTOs.MovimientoDTO m = servicio.registrarMovimiento(branchId,
                new CajaDTOs.NuevoMovimiento("salida", new BigDecimal("200"), " Pago al gas "), cajera);
        assertEquals("SALIDA", m.tipo());
        assertEquals("Pago al gas", m.concepto());

        assertThrows(IllegalArgumentException.class, () -> servicio.registrarMovimiento(branchId,
                new CajaDTOs.NuevoMovimiento("PRESTAMO", new BigDecimal("1"), "x"), cajera));

        turno.setCerradoEn(LocalDateTime.now());
        assertThrows(IllegalStateException.class, () -> servicio.registrarMovimiento(branchId,
                new CajaDTOs.NuevoMovimiento("ENTRADA", new BigDecimal("1"), "x"), cajera));
    }

    @Test
    @DisplayName("Abrir guarda el fondo y quién abrió")
    void abrir() {
        turno.setCerradoEn(LocalDateTime.now());
        servicio.abrir(branchId, new BigDecimal("750"), cajera);

        ArgumentCaptor<TurnoCaja> captor = ArgumentCaptor.forClass(TurnoCaja.class);
        verify(turnoRepository).save(captor.capture());
        assertEquals(new BigDecimal("750.00"), captor.getValue().getFondoInicial());
        assertEquals("lupita", captor.getValue().getAbiertoPorNombre());
        assertTrue(captor.getValue().abierto());
    }
}
