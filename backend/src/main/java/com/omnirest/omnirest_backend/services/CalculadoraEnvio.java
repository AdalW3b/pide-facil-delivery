package com.omnirest.omnirest_backend.services;

import java.math.BigDecimal;
import java.math.RoundingMode;

/**
 * Calcula cuanto cuesta un envio y como se reparte entre restaurante y cliente.
 *
 * La regla: los primeros kilometros forman el tramo base, que cubre la tarifa
 * base. A partir de ahi, cada kilometro extra suma. Cuanto absorbe el
 * restaurante de cada tramo es configurable por sucursal, asi que la misma
 * formula sirve para "envio gratis hasta 3 km" y para "el cliente paga la mitad
 * desde el primer kilometro".
 *
 * No toca la base de datos a proposito: es aritmetica pura y se puede probar
 * sola.
 */
public final class CalculadoraEnvio {

    private CalculadoraEnvio() {
    }

    /** Parametros de la sucursal que intervienen en el calculo. */
    public record Tarifa(
            BigDecimal kmIncluidos,
            BigDecimal tarifaBase,
            BigDecimal pctBaseAbsorbe,
            BigDecimal precioKmExtra,
            BigDecimal pctExtraAbsorbe,
            BigDecimal redondeoKm,
            BigDecimal distanciaMaximaKm) {
    }

    /**
     * Resultado del calculo. Si {@code fueraDeCobertura} es true, los importes
     * vienen en cero y el pedido no debe aceptarse.
     */
    public record Envio(
            BigDecimal distanciaKm,
            BigDecimal kmExtra,
            BigDecimal costoTotal,
            BigDecimal absorbeRestaurante,
            BigDecimal pagaCliente,
            boolean fueraDeCobertura) {
    }

    public static Envio calcular(BigDecimal distanciaKm, Tarifa tarifa) {
        if (distanciaKm == null || tarifa == null) {
            throw new IllegalArgumentException("Falta la distancia o la tarifa de la sucursal.");
        }
        if (distanciaKm.signum() < 0) {
            throw new IllegalArgumentException("La distancia no puede ser negativa.");
        }

        if (distanciaKm.compareTo(tarifa.distanciaMaximaKm()) > 0) {
            return new Envio(dos(distanciaKm), BigDecimal.ZERO,
                    BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, true);
        }

        BigDecimal kmExtra = kmExtra(distanciaKm, tarifa);
        BigDecimal cargoExtra = kmExtra.multiply(tarifa.precioKmExtra());
        BigDecimal costoTotal = tarifa.tarifaBase().add(cargoExtra);

        BigDecimal absorbe = tarifa.tarifaBase().multiply(tarifa.pctBaseAbsorbe())
                .add(cargoExtra.multiply(tarifa.pctExtraAbsorbe()));
        // El restaurante nunca absorbe mas de lo que cuesta el envio.
        if (absorbe.compareTo(costoTotal) > 0) {
            absorbe = costoTotal;
        }
        BigDecimal pagaCliente = costoTotal.subtract(absorbe);

        return new Envio(dos(distanciaKm), kmExtra, dos(costoTotal), dos(absorbe), dos(pagaCliente), false);
    }

    /**
     * Kilometros que se cobran aparte. Se redondea SIEMPRE hacia arriba al
     * escalon configurado: con escalon de 1 km, 1,3 km extra se cobran como 2.
     * Nunca es negativo: dentro del tramo base da cero.
     */
    private static BigDecimal kmExtra(BigDecimal distanciaKm, Tarifa tarifa) {
        BigDecimal sobrante = distanciaKm.subtract(tarifa.kmIncluidos());
        if (sobrante.signum() <= 0) {
            return BigDecimal.ZERO;
        }
        BigDecimal escalon = tarifa.redondeoKm();
        BigDecimal escalones = sobrante.divide(escalon, 0, RoundingMode.CEILING);
        return escalones.multiply(escalon).stripTrailingZeros();
    }

    private static BigDecimal dos(BigDecimal valor) {
        return valor.setScale(2, RoundingMode.HALF_UP);
    }
}
