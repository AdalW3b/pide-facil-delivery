package com.omnirest.omnirest_backend.dtos;

import java.math.BigDecimal;

/**
 * Lo que el comensal ve arriba del menú en línea: de quién es, si hoy se
 * entrega a domicilio, cuánto tarda y desde cuánto cuesta el envío.
 */
public record InfoPublicaSucursalDTO(
        String restaurante,
        String sucursal,
        String direccion,
        boolean entregaActiva,
        Integer minutosEstimados,
        /** Lo que paga el cliente dentro de los km incluidos (0 = gratis). */
        BigDecimal envioDesde,
        BigDecimal kmIncluidos,
        BigDecimal pedidoMinimo
) {}
