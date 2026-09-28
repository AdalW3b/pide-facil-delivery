package com.omnirest.omnirest_backend.services;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class DistanciaTest {

    // Dos puntos conocidos del centro de la Ciudad de Mexico, separados por
    // poco menos de 4 km en linea recta.
    private static final BigDecimal ZOCALO_LAT = new BigDecimal("19.4326");
    private static final BigDecimal ZOCALO_LON = new BigDecimal("-99.1332");
    private static final BigDecimal ANGEL_LAT = new BigDecimal("19.4270");
    private static final BigDecimal ANGEL_LON = new BigDecimal("-99.1677");

    @Test
    @DisplayName("Mide la linea recta entre dos puntos conocidos")
    void lineaRectaEntrePuntosConocidos() {
        BigDecimal km = Distancia.lineaRecta(ZOCALO_LAT, ZOCALO_LON, ANGEL_LAT, ANGEL_LON);

        // 3.67 km segun cualquier mapa; se admite un margen de 50 m.
        assertTrue(km.subtract(new BigDecimal("3.67")).abs().compareTo(new BigDecimal("0.05")) <= 0,
                "esperaba ~3.67 km y dio " + km);
    }

    @Test
    @DisplayName("El mismo punto esta a cero kilometros")
    void mismoPunto() {
        BigDecimal km = Distancia.lineaRecta(ZOCALO_LAT, ZOCALO_LON, ZOCALO_LAT, ZOCALO_LON);
        assertEquals(0, km.compareTo(BigDecimal.ZERO));
    }

    @Test
    @DisplayName("Medir es simetrico: da igual quien va primero")
    void simetrica() {
        BigDecimal ida = Distancia.lineaRecta(ZOCALO_LAT, ZOCALO_LON, ANGEL_LAT, ANGEL_LON);
        BigDecimal vuelta = Distancia.lineaRecta(ANGEL_LAT, ANGEL_LON, ZOCALO_LAT, ZOCALO_LON);
        assertEquals(0, ida.compareTo(vuelta));
    }

    @Test
    @DisplayName("El factor de calles infla la linea recta")
    void factorDeCalles() {
        BigDecimal recta = Distancia.lineaRecta(ZOCALO_LAT, ZOCALO_LON, ANGEL_LAT, ANGEL_LON);
        BigDecimal porCalles = Distancia.porCalles(ZOCALO_LAT, ZOCALO_LON, ANGEL_LAT, ANGEL_LON,
                new BigDecimal("1.30"));

        assertEquals(0, porCalles.compareTo(recta.multiply(new BigDecimal("1.30"))
                .setScale(2, java.math.RoundingMode.HALF_UP)));
        assertTrue(porCalles.compareTo(recta) > 0, "manejando siempre se recorre mas que en linea recta");
    }

    @Test
    @DisplayName("Un factor sin configurar deja la distancia tal cual, no la anula")
    void factorAusenteNoAnulaLaDistancia() {
        BigDecimal recta = Distancia.lineaRecta(ZOCALO_LAT, ZOCALO_LON, ANGEL_LAT, ANGEL_LON);

        assertEquals(0, Distancia.porCalles(ZOCALO_LAT, ZOCALO_LON, ANGEL_LAT, ANGEL_LON, null).compareTo(recta));
        assertEquals(0, Distancia.porCalles(ZOCALO_LAT, ZOCALO_LON, ANGEL_LAT, ANGEL_LON, BigDecimal.ZERO)
                .compareTo(recta));
    }

    @Test
    @DisplayName("Sin coordenadas no se inventa una distancia")
    void faltanCoordenadas() {
        assertThrows(IllegalArgumentException.class,
                () -> Distancia.lineaRecta(null, ZOCALO_LON, ANGEL_LAT, ANGEL_LON));
        assertThrows(IllegalArgumentException.class,
                () -> Distancia.lineaRecta(ZOCALO_LAT, ZOCALO_LON, ANGEL_LAT, null));
    }
}
