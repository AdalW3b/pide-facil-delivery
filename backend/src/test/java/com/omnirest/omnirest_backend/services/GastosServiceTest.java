package com.omnirest.omnirest_backend.services;

import com.omnirest.omnirest_backend.domain.entities.Gasto;
import com.omnirest.omnirest_backend.domain.entities.GastoFijo;
import com.omnirest.omnirest_backend.dtos.GastosDTOs;
import com.omnirest.omnirest_backend.repositories.BranchRepository;
import com.omnirest.omnirest_backend.repositories.GastoFijoRepository;
import com.omnirest.omnirest_backend.repositories.GastoRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** Gastos: pago con caja, gastos fijos del mes y anulación. */
class GastosServiceTest {

    private final UUID branchId = UUID.randomUUID();
    private final BranchRepository branches = mock(BranchRepository.class);
    private final GastoRepository gastos = mock(GastoRepository.class);
    private final GastoFijoRepository fijos = mock(GastoFijoRepository.class);
    private final CajaService caja = mock(CajaService.class);
    private GastosService servicio;

    @BeforeEach
    void setUp() {
        servicio = new GastosService(branches, gastos, fijos, caja);
        when(branches.existsById(branchId)).thenReturn(true);
        when(gastos.save(any(Gasto.class))).thenAnswer(i -> i.getArgument(0));
    }

    private GastosDTOs.NuevoGasto gasto(String forma, LocalDate fecha, UUID fijo) {
        return new GastosDTOs.NuevoGasto("luz", "Recibo CFE", new BigDecimal("1840.5"), fecha, forma, null, fijo);
    }

    @Test
    @DisplayName("Pagado con efectivo de caja: sale de la caja y queda ligado")
    void conCaja() {
        UUID mov = UUID.randomUUID();
        when(caja.salidaPorGasto(eq(branchId), any(), anyString(), any())).thenReturn(mov);

        servicio.registrar(branchId, gasto("CAJA", null, null));

        verify(caja).salidaPorGasto(eq(branchId), eq(new BigDecimal("1840.50")), contains("Recibo CFE"), any());
        ArgumentCaptor<Gasto> g = ArgumentCaptor.forClass(Gasto.class);
        verify(gastos).save(g.capture());
        assertEquals("LUZ", g.getValue().getCategoria());
        assertEquals(mov, g.getValue().getMovimientoCajaId());
    }

    @Test
    @DisplayName("Por transferencia no toca la caja; la fecha no puede ser futura")
    void transferenciaYFecha() {
        servicio.registrar(branchId, gasto("TRANSFERENCIA", null, null));
        verify(caja, never()).salidaPorGasto(any(), any(), any(), any());
        assertThrows(IllegalArgumentException.class,
                () -> servicio.registrar(branchId, gasto("TRANSFERENCIA", Combos.hoy().plusDays(2), null)));
        assertThrows(IllegalArgumentException.class,
                () -> servicio.registrar(branchId, new GastosDTOs.NuevoGasto("comida", "x", BigDecimal.TEN, null, "CAJA", null, null)),
                "categoría que no existe");
    }

    @Test
    @DisplayName("Un gasto fijo no se paga dos veces en el mismo mes")
    void fijoDosVeces() {
        GastoFijo renta = GastoFijo.builder().id(UUID.randomUUID()).branchId(branchId).categoria("RENTA").concepto("Renta del local")
                .monto(new BigDecimal("12000")).diaDelMes(1).build();
        when(fijos.findById(renta.getId())).thenReturn(Optional.of(renta));
        when(gastos.existsByGastoFijoIdAndAnuladoEnIsNullAndFechaGreaterThanEqualAndFechaLessThan(eq(renta.getId()), any(), any())).thenReturn(true);
        assertThrows(IllegalStateException.class, () -> servicio.registrar(branchId, gasto("TRANSFERENCIA", null, renta.getId())));
    }

    @Test
    @DisplayName("El mes: lo gastado, lo pagado de los fijos y lo que falta")
    void mes() {
        GastoFijo renta = GastoFijo.builder().id(UUID.randomUUID()).branchId(branchId).categoria("RENTA").concepto("Renta")
                .monto(new BigDecimal("12000")).diaDelMes(1).activo(true).build();
        GastoFijo nomina = GastoFijo.builder().id(UUID.randomUUID()).branchId(branchId).categoria("NOMINA").concepto("Nómina")
                .monto(new BigDecimal("8000")).diaDelMes(31).activo(true).build();
        when(fijos.findByBranchIdOrderByDiaDelMesAscConceptoAsc(branchId)).thenReturn(List.of(renta, nomina));
        Gasto pagoRenta = Gasto.builder().id(UUID.randomUUID()).branchId(branchId).categoria("RENTA").concepto("Renta")
                .monto(new BigDecimal("12000.00")).fecha(LocalDate.of(2026, 2, 2)).formaPago("TRANSFERENCIA").gastoFijoId(renta.getId()).build();
        Gasto anulado = Gasto.builder().id(UUID.randomUUID()).branchId(branchId).categoria("LUZ").concepto("Luz")
                .monto(new BigDecimal("900.00")).fecha(LocalDate.of(2026, 2, 5)).formaPago("CAJA")
                .anuladoEn(java.time.LocalDateTime.now()).build();
        when(gastos.findByBranchIdAndFechaGreaterThanEqualAndFechaLessThanOrderByFechaDescCreadoEnDesc(
                branchId, LocalDate.of(2026, 2, 1), LocalDate.of(2026, 3, 1))).thenReturn(List.of(pagoRenta, anulado));

        GastosDTOs.Mes m = servicio.mes(branchId, "2026-02");

        assertEquals(new BigDecimal("12000.00"), m.total(), "lo anulado no cuenta");
        assertEquals(new BigDecimal("8000.00"), m.pendiente(), "falta la nómina");
        assertNotNull(m.fijos().get(0).pago());
        assertNull(m.fijos().get(1).pago());
        assertEquals(LocalDate.of(2026, 2, 28), m.fijos().get(1).vence(), "el 31 en febrero es el último día");
    }

    @Test
    @DisplayName("Anular un gasto en efectivo regresa el dinero a la caja")
    void anular() {
        Gasto g = Gasto.builder().id(UUID.randomUUID()).branchId(branchId).categoria("GAS").concepto("Gas LP")
                .monto(new BigDecimal("650.00")).fecha(Combos.hoy()).formaPago("CAJA").movimientoCajaId(UUID.randomUUID()).build();
        when(gastos.findById(g.getId())).thenReturn(Optional.of(g));

        servicio.anular(branchId, g.getId());

        verify(caja).entradaPorGastoAnulado(eq(branchId), eq(new BigDecimal("650.00")), contains("Gas LP"), any());
        assertNotNull(g.getAnuladoEn());
        assertThrows(IllegalStateException.class, () -> servicio.anular(branchId, g.getId()));
    }

    @Test
    @DisplayName("El día de pago se ajusta a meses cortos")
    void vence() {
        assertEquals(LocalDate.of(2026, 4, 30), GastosService.vence(YearMonth.of(2026, 4), 31));
        assertEquals(LocalDate.of(2026, 4, 15), GastosService.vence(YearMonth.of(2026, 4), 15));
    }
}
