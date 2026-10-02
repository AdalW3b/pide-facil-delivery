package com.omnirest.omnirest_backend.services;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/** Las cuentas del arqueo, sin base de datos. */
class ArqueoCajaTest {

    private static BigDecimal $(String valor) {
        return new BigDecimal(valor);
    }

    @Test
    @DisplayName("Esperado = fondo + efectivo cobrado + propinas en efectivo + entradas - salidas + cortes")
    void esperado() {
        BigDecimal esperado = ArqueoCaja.esperado($("500"), $("300"), $("20"), $("100"), $("50"), $("400"));
        assertEquals($("1270.00"), esperado);
    }

    @Test
    @DisplayName("Sin movimientos, el esperado es el fondo")
    void soloFondo() {
        assertEquals($("500.00"), ArqueoCaja.esperado($("500"), null, null, null, null, null));
    }

    @Test
    @DisplayName("Suma billetes y monedas, incluido el de 50 centavos")
    void conteo() {
        Map<String, Integer> conteo = new LinkedHashMap<>();
        conteo.put("500", 2);
        conteo.put("200", 1);
        conteo.put("20", 3);
        conteo.put("0.5", 3);
        assertEquals($("1261.50"), ArqueoCaja.totalConteo(conteo));
    }

    @Test
    @DisplayName("Rechaza denominaciones que no existen y piezas negativas")
    void conteoInvalido() {
        assertThrows(IllegalArgumentException.class, () -> ArqueoCaja.totalConteo(Map.of("300", 1)));
        assertThrows(IllegalArgumentException.class, () -> ArqueoCaja.totalConteo(Map.of("100", -1)));
    }

    @Test
    @DisplayName("500.00 y 500 son la misma denominación; .5 y 0.50 también")
    void normaliza() {
        assertEquals("500", ArqueoCaja.normalizar("500.00"));
        assertEquals("0.5", ArqueoCaja.normalizar(".5"));
        assertEquals("0.5", ArqueoCaja.normalizar("0.50"));
        assertEquals($("1000.50"), ArqueoCaja.totalConteo(Map.of("500.00", 2, "0.50", 1)));
    }
}
