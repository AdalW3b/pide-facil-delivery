package com.omnirest.omnirest_backend.services;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;

import static org.junit.jupiter.api.Assertions.*;

/** Rangos de fechas y comparacion contra el periodo anterior. */
class AnalyticsServiceTest {

    @Test
    @DisplayName("El rango incluye el día final completo y el anterior es del mismo largo")
    void rangos() {
        AnalyticsService.Rango r = AnalyticsService.Rango.de(LocalDate.of(2026, 9, 24), LocalDate.of(2026, 9, 30));
        assertEquals(LocalDate.of(2026, 9, 24).atStartOfDay(), r.desde());
        assertEquals(LocalDate.of(2026, 10, 1).atStartOfDay(), r.hasta(), "hasta el 30 a las 23:59");

        AnalyticsService.Rango antes = r.anterior();
        assertEquals(LocalDate.of(2026, 9, 17).atStartOfDay(), antes.desde(), "7 días antes");
        assertEquals(r.desde(), antes.hasta());
    }

    @Test
    @DisplayName("Sin fecha de inicio es todo el histórico, sin periodo anterior")
    void historico() {
        AnalyticsService.Rango r = AnalyticsService.Rango.de(null, LocalDate.of(2026, 9, 30));
        assertNull(r.desde());
        assertNull(r.anterior());
    }

    @Test
    @DisplayName("Inicio después del fin se rechaza")
    void rangoAlReves() {
        assertThrows(IllegalArgumentException.class,
                () -> AnalyticsService.Rango.de(LocalDate.of(2026, 9, 30), LocalDate.of(2026, 9, 1)));
    }

    @Test
    @DisplayName("Sin ventas antes no hay porcentaje (antes salía +100%)")
    void crecimiento() {
        assertNull(AnalyticsService.crecimiento(500, 0));
        assertEquals(50.0, AnalyticsService.crecimiento(150, 100));
        assertEquals(-25.0, AnalyticsService.crecimiento(75, 100));
    }
}
