package com.omnirest.omnirest_backend.dtos;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

/** El pin que el cliente puso en el mapa, para saber cuanto costaria llevarle. */
public record CotizacionEnvioRequestDTO(
        @NotNull @DecimalMin("-90.0") @DecimalMax("90.0") BigDecimal latitud,
        @NotNull @DecimalMin("-180.0") @DecimalMax("180.0") BigDecimal longitud) {
}
