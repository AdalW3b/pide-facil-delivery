package com.omnirest.omnirest_backend.services;

import java.math.BigDecimal;
import java.math.RoundingMode;

/**
 * Distancia entre dos puntos del mapa.
 *
 * Por ahora se calcula en linea recta (formula del haversine) y se multiplica
 * por un factor de calles, porque nadie maneja en linea recta. Cuando se
 * conecte un servicio de rutas, este es el unico lugar que cambia: quien lo
 * llama solo pide "cuantos km hay" y no sabe como se obtuvieron.
 */
public final class Distancia {

    /** Radio medio de la Tierra en kilometros. */
    private static final double RADIO_TIERRA_KM = 6371.0088;

    private Distancia() {
    }

    /** Linea recta en kilometros entre dos coordenadas. */
    public static BigDecimal lineaRecta(BigDecimal latA, BigDecimal lonA, BigDecimal latB, BigDecimal lonB) {
        if (latA == null || lonA == null || latB == null || lonB == null) {
            throw new IllegalArgumentException("Faltan coordenadas para medir la distancia.");
        }

        double lat1 = Math.toRadians(latA.doubleValue());
        double lat2 = Math.toRadians(latB.doubleValue());
        double dLat = lat2 - lat1;
        double dLon = Math.toRadians(lonB.subtract(lonA).doubleValue());

        double a = Math.pow(Math.sin(dLat / 2), 2)
                + Math.cos(lat1) * Math.cos(lat2) * Math.pow(Math.sin(dLon / 2), 2);
        double km = 2 * RADIO_TIERRA_KM * Math.asin(Math.min(1.0, Math.sqrt(a)));

        return BigDecimal.valueOf(km).setScale(2, RoundingMode.HALF_UP);
    }

    /**
     * Estimacion de lo que realmente recorre el repartidor: la linea recta
     * inflada por el factor de calles de la sucursal.
     */
    public static BigDecimal porCalles(BigDecimal latA, BigDecimal lonA, BigDecimal latB, BigDecimal lonB,
            BigDecimal factorCalles) {
        BigDecimal factor = (factorCalles == null || factorCalles.signum() <= 0)
                ? BigDecimal.ONE
                : factorCalles;
        return lineaRecta(latA, lonA, latB, lonB)
                .multiply(factor)
                .setScale(2, RoundingMode.HALF_UP);
    }
}
