package com.omnirest.omnirest_backend.dtos;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

public record ProductRequestDTO(
    @NotNull UUID categoryId,
    @NotBlank String name,
    @NotNull BigDecimal price,
    String description,
    Boolean active,
    Boolean trackStock,
    Integer stock,
    Boolean isRecipe,
    List<RecipeItemDTO> recipeItems
) {}
