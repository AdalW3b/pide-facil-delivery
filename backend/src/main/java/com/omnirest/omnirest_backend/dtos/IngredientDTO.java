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
    Boolean active
) {}
