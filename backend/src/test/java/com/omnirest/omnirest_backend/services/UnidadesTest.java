package com.omnirest.omnirest_backend.services;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.*;

class UnidadesTest {

    @ParameterizedTest(name = "\"{0}\" se escribe \"{1}\"")
    @CsvSource({
            "Kilos, kg", "KG, kg", "kilogramos, kg", "gr, g", "Gramos, g",
            "lt, l", "Litro, l", "L, l", "mililitros, ml",
            "pza, pieza", "pz, pieza", "Piezas, pieza", "manojo, manojo", "' kg. ', kg"
    })
    void unaSolaFormaDeEscribirCadaUnidad(String escrita, String canonica) {
        assertEquals(canonica, Unidades.canonica(escrita));
    }

    @ParameterizedTest(name = "{0} {1} = {3} {2}")
    @CsvSource({
            "250, g, kg, 0.25",
            "1.5, kg, g, 1500",
            "330, ml, l, 0.33",
            "2, lt, ml, 2000",
            "3, pza, pieza, 3",
            "5, kg, kg, 5"
    })
    void convierteDentroDeLaMismaFamilia(String cantidad, String desde, String hacia, String esperado) {
        BigDecimal resultado = Unidades.convertir(new BigDecimal(cantidad), desde, hacia);
        assertEquals(0, resultado.compareTo(new BigDecimal(esperado)), () -> "salió " + resultado);
    }

    @Test
    @DisplayName("Gramos y mililitros, o gramos y piezas, no se pueden convertir")
    void noConvierteEntreFamilias() {
        assertFalse(Unidades.compatibles("g", "ml"));
        assertFalse(Unidades.compatibles("kg", "pieza"));
        assertThrows(IllegalArgumentException.class, () -> Unidades.convertir(BigDecimal.TEN, "g", "ml"));
    }

    @Test
    @DisplayName("Sin unidad, la cantidad queda igual")
    void sinUnidadNoConvierte() {
        assertTrue(Unidades.compatibles(null, "kg"));
        assertEquals(0, Unidades.convertir(BigDecimal.TEN, null, "kg").compareTo(BigDecimal.TEN));
    }
}
