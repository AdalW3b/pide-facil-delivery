package com.omnirest.omnirest_backend.services;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Fija la tabla de ejemplo acordada en el plan de delivery. Si alguien cambia
 * la formula, estas pruebas lo cazan antes de que un cliente pague de mas.
 */
class CalculadoraEnvioTest {

    /** La tarifa del ejemplo: 3 km base a $40, $10 por km extra, hasta 8 km. */
    private static CalculadoraEnvio.Tarifa tarifaDelEjemplo() {
        return new CalculadoraEnvio.Tarifa(
                new BigDecimal("3.00"),   // km incluidos
                new BigDecimal("40.00"),  // tarifa base
                new BigDecimal("1.000"),  // el restaurante absorbe todo el tramo base
                new BigDecimal("10.00"),  // precio por km extra
                new BigDecimal("0.000"),  // el cliente paga todo el extra
                new BigDecimal("1.00"),   // se cobra por km entero
                new BigDecimal("8.00"));  // mas lejos, fuera de cobertura
    }

    @ParameterizedTest(name = "{0} km -> envio {2}, absorbe {3}, cliente paga {4}")
    @CsvSource({
            "2.0, 0, 40.00, 40.00, 0.00",
            "3.0, 0, 40.00, 40.00, 0.00",
            "4.3, 2, 60.00, 40.00, 20.00",
            "6.0, 3, 70.00, 40.00, 30.00",
            "8.0, 5, 90.00, 40.00, 50.00"
    })
    @DisplayName("La tabla de ejemplo del plan se cumple al peso")
    void tablaDelPlan(String distancia, String kmExtra, String costo, String absorbe, String cliente) {
        var envio = CalculadoraEnvio.calcular(new BigDecimal(distancia), tarifaDelEjemplo());

        assertFalse(envio.fueraDeCobertura(), "debería estar dentro de cobertura");
        assertEquals(0, envio.kmExtra().compareTo(new BigDecimal(kmExtra)), "km extra");
        assertEquals(0, envio.costoTotal().compareTo(new BigDecimal(costo)), "costo del envío");
        assertEquals(0, envio.absorbeRestaurante().compareTo(new BigDecimal(absorbe)), "lo que absorbe");
        assertEquals(0, envio.pagaCliente().compareTo(new BigDecimal(cliente)), "lo que paga el cliente");
    }

    @Test
    @DisplayName("Más allá de la distancia máxima, el pedido queda fuera de cobertura")
    void fueraDeCobertura() {
        var envio = CalculadoraEnvio.calcular(new BigDecimal("9.1"), tarifaDelEjemplo());

        assertTrue(envio.fueraDeCobertura());
        assertEquals(0, envio.costoTotal().compareTo(BigDecimal.ZERO));
        assertEquals(0, envio.pagaCliente().compareTo(BigDecimal.ZERO));
    }

    @Test
    @DisplayName("Justo en el límite de cobertura todavía se acepta")
    void limiteExactoSeAcepta() {
        var envio = CalculadoraEnvio.calcular(new BigDecimal("8.00"), tarifaDelEjemplo());
        assertFalse(envio.fueraDeCobertura());
    }

    @Test
    @DisplayName("Un metro pasado el tramo base ya cobra un kilómetro completo")
    void redondeoHaciaArriba() {
        var envio = CalculadoraEnvio.calcular(new BigDecimal("3.01"), tarifaDelEjemplo());

        assertEquals(0, envio.kmExtra().compareTo(BigDecimal.ONE), "se cobra 1 km, no 0.01");
        assertEquals(0, envio.pagaCliente().compareTo(new BigDecimal("10.00")));
    }

    @Test
    @DisplayName("Con escalón de medio kilómetro, 1.2 km extra se cobran como 1.5")
    void escalonDeMedioKilometro() {
        var media = new CalculadoraEnvio.Tarifa(
                new BigDecimal("3.00"), new BigDecimal("40.00"), new BigDecimal("1.000"),
                new BigDecimal("10.00"), new BigDecimal("0.000"),
                new BigDecimal("0.50"), new BigDecimal("8.00"));

        var envio = CalculadoraEnvio.calcular(new BigDecimal("4.2"), media);

        assertEquals(0, envio.kmExtra().compareTo(new BigDecimal("1.5")));
        assertEquals(0, envio.pagaCliente().compareTo(new BigDecimal("15.00")));
    }

    @Test
    @DisplayName("Si la sucursal absorbe la mitad del tramo base, el cliente paga la otra mitad")
    void absorbeSoloLaMitadDelTramoBase() {
        var mitad = new CalculadoraEnvio.Tarifa(
                new BigDecimal("3.00"), new BigDecimal("40.00"), new BigDecimal("0.500"),
                new BigDecimal("10.00"), new BigDecimal("0.000"),
                new BigDecimal("1.00"), new BigDecimal("8.00"));

        var envio = CalculadoraEnvio.calcular(new BigDecimal("2.0"), mitad);

        assertEquals(0, envio.costoTotal().compareTo(new BigDecimal("40.00")));
        assertEquals(0, envio.absorbeRestaurante().compareTo(new BigDecimal("20.00")));
        assertEquals(0, envio.pagaCliente().compareTo(new BigDecimal("20.00")));
    }

    @Test
    @DisplayName("Si la sucursal absorbe también el extra, el cliente no paga nada de más")
    void absorbeTambienElExtra() {
        var todoIncluido = new CalculadoraEnvio.Tarifa(
                new BigDecimal("3.00"), new BigDecimal("40.00"), new BigDecimal("1.000"),
                new BigDecimal("10.00"), new BigDecimal("1.000"),
                new BigDecimal("1.00"), new BigDecimal("8.00"));

        var envio = CalculadoraEnvio.calcular(new BigDecimal("6.0"), todoIncluido);

        assertEquals(0, envio.costoTotal().compareTo(new BigDecimal("70.00")));
        assertEquals(0, envio.absorbeRestaurante().compareTo(new BigDecimal("70.00")));
        assertEquals(0, envio.pagaCliente().compareTo(BigDecimal.ZERO));
    }

    @Test
    @DisplayName("Una distancia negativa es un error de quien llama, no un envío gratis")
    void distanciaNegativa() {
        assertThrows(IllegalArgumentException.class,
                () -> CalculadoraEnvio.calcular(new BigDecimal("-1"), tarifaDelEjemplo()));
    }

    @Test
    void pagoAlRepartidorEsFijoMasPorKm() {
        // Sucursal prime: $12 fijo + $6 por km. 2.2 km = $25.20, lo mismo en el grupo y en el tablero.
        assertEquals(new BigDecimal("25.20"),
                CalculadoraEnvio.pagoRepartidor(new BigDecimal("12"), new BigDecimal("6"), new BigDecimal("2.2")));
        assertEquals(new BigDecimal("12.00"),
                CalculadoraEnvio.pagoRepartidor(new BigDecimal("12"), null, new BigDecimal("5")));
    }
}
