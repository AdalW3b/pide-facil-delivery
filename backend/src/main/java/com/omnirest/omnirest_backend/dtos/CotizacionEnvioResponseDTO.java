package com.omnirest.omnirest_backend.dtos;

import java.math.BigDecimal;

/**
 * Lo que se le muestra al cliente antes de pedir. {@code costoEnvio} es el
 * total del envio, pero al cliente solo se le cobra {@code pagaCliente}: la
 * diferencia la absorbe el restaurante.
 */
public record CotizacionEnvioResponseDTO(
        boolean disponible,
        boolean fueraDeCobertura,
        BigDecimal distanciaKm,
        BigDecimal costoEnvio,
        BigDecimal absorbeRestaurante,
        BigDecimal pagaCliente,
        BigDecimal pedidoMinimo,
        Integer minutosEstimados,
        String mensaje) {
}
