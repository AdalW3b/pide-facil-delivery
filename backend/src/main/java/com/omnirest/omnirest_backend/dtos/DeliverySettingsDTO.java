package com.omnirest.omnirest_backend.dtos;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.PositiveOrZero;

import java.math.BigDecimal;

/**
 * Configuracion de delivery de una sucursal, tal como se edita en el panel.
 * Los porcentajes van de 0 a 1: 1.000 significa que el restaurante absorbe todo
 * ese tramo y el cliente no lo ve.
 */
public record DeliverySettingsDTO(
        Boolean activo,
        @DecimalMin("-90.0") @DecimalMax("90.0") BigDecimal latitud,
        @DecimalMin("-180.0") @DecimalMax("180.0") BigDecimal longitud,
        @PositiveOrZero BigDecimal kmIncluidos,
        @PositiveOrZero BigDecimal tarifaBase,
        @DecimalMin("0.0") @DecimalMax("1.0") BigDecimal pctBaseAbsorbe,
        @PositiveOrZero BigDecimal precioKmExtra,
        @DecimalMin("0.0") @DecimalMax("1.0") BigDecimal pctExtraAbsorbe,
        @DecimalMin("0.01") BigDecimal redondeoKm,
        @DecimalMin("0.01") BigDecimal distanciaMaximaKm,
        @DecimalMin("1.0") BigDecimal factorCalles,
        @PositiveOrZero BigDecimal pedidoMinimo,
        Integer minutosEstimados,
        String grupoRepartidores,
        @PositiveOrZero BigDecimal pagoRepartidorFijo,
        @PositiveOrZero BigDecimal pagoRepartidorKm) {
}
