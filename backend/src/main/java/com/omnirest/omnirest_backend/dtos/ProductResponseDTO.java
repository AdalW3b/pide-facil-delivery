package com.omnirest.omnirest_backend.dtos;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

public record ProductResponseDTO(
    UUID id,
    UUID categoryId,
    String categoryName,
    String name,
    BigDecimal price,
    String description,
    Boolean active,
    Boolean trackStock,
    Integer stock,
    Boolean isRecipe,
    List<RecipeItemDTO> recipeItems
) {}
