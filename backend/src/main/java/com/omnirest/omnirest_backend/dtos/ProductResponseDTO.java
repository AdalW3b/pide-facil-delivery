package com.omnirest.omnirest_backend.dtos;

import java.math.BigDecimal;
import java.time.LocalDate;
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
    List<RecipeItemDTO> recipeItems,
    Boolean isCombo,
    List<ComboItemDTO> comboItems,
    /** Lo que costarian sus platillos por separado; null si no es combo. */
    BigDecimal precioNormal,
    LocalDate promoDesde,
    LocalDate promoHasta,
    List<Integer> promoDias,
    /** "martes y jueves, del 1 oct al 31 oct"; null si se vende siempre. */
    String vigencia,
    /** Si hoy se puede vender (fecha de Mexico). */
    Boolean vigenteHoy
) {}
