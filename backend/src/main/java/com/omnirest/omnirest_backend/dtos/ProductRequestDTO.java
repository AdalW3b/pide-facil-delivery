package com.omnirest.omnirest_backend.dtos;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.LocalDate;
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
    List<RecipeItemDTO> recipeItems,
    /** Combo o paquete: lleva platillos en vez de receta. */
    Boolean isCombo,
    List<ComboItemDTO> comboItems,
    /** Vigencia de la promocion; todo opcional. Dias ISO: 1 = lunes ... 7 = domingo. */
    LocalDate promoDesde,
    LocalDate promoHasta,
    List<Integer> promoDias
) {
    /** Platillo sin combo ni vigencia: la forma que ya usaban los formularios y pruebas. */
    public ProductRequestDTO(UUID categoryId, String name, BigDecimal price, String description, Boolean active,
                             Boolean trackStock, Integer stock, Boolean isRecipe, List<RecipeItemDTO> recipeItems) {
        this(categoryId, name, price, description, active, trackStock, stock, isRecipe, recipeItems,
                false, null, null, null, null);
    }
}
