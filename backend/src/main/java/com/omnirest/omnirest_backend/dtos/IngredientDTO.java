package com.omnirest.omnirest_backend.dtos;

import jakarta.validation.constraints.NotBlank;
import java.math.BigDecimal;
import java.util.UUID;

public record IngredientDTO(
    UUID id,
    UUID restaurantId,
    @NotBlank String name,
    String unitOfMeasure,
    BigDecimal stock,
    Boolean active,
    /** Por debajo de esto se avisa que queda poco. Null = sin alerta. */
    BigDecimal minimo,
    /** En cuantos platillos se usa (receta). */
    Integer usos,
    /** Se hace en cocina por tandas (Inventario > Preparaciones). Solo lectura. */
    Boolean esPreparado,
    /** Costo por unidad en la sucursal elegida (o el general). Solo lectura: se captura en Inventario. */
    BigDecimal costo
) {
    public IngredientDTO(UUID id, UUID restaurantId, String name, String unitOfMeasure, BigDecimal stock, Boolean active) {
        this(id, restaurantId, name, unitOfMeasure, stock, active, null, null, null, null);
    }
}
