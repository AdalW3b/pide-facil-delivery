package com.omnirest.omnirest_backend.dtos;

import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.util.UUID;

public record RecipeItemDTO(
    UUID id,
    @NotNull UUID ingredientId,
    String ingredientName,
    String unitOfMeasure,
    String recipeUnit,
    BigDecimal quantity,
    BigDecimal requiredPerUnit,
    BigDecimal totalRequiredForMaxStock,
    BigDecimal availableStockInBranch
) {}
