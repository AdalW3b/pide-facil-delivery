package com.omnirest.omnirest_backend.services;

import com.omnirest.omnirest_backend.domain.entities.*;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/** Costo promedio de las compras y costo de cada platillo. */
class CostosTest {

    private static BigDecimal n(String v) {
        return new BigDecimal(v);
    }

    @Test
    @DisplayName("El costo promedio pondera lo que había con lo que llega")
    void promedioPonderado() {
        // Había 2 kg a $100 y llegan 3 kg a $150: (200 + 450) / 5 = $130.
        assertEquals(0, InventoryService.promedio(n("100"), n("2"), n("3"), n("150")).compareTo(n("130")));
        // Sin existencias (o en negativo) manda el precio nuevo.
        assertEquals(0, InventoryService.promedio(n("100"), n("-1"), n("3"), n("150")).compareTo(n("150")));
        assertEquals(0, InventoryService.promedio(null, n("5"), n("1"), n("80")).compareTo(n("80")));
    }

    @Test
    @DisplayName("Costo de una receta, de un combo y costo parcial cuando falta un precio")
    void costoDePlatillo() {
        Ingredient carne = Ingredient.builder().name("Carne").unitOfMeasure("kg").costoPromedio(n("200")).build();
        Ingredient tortilla = Ingredient.builder().name("Tortilla").unitOfMeasure("pieza").costoPromedio(n("1.5")).build();
        Product taco = Product.builder().name("Taco").price(n("25")).isRecipe(true).build();
        List<RecipeItem> receta = List.of(
                RecipeItem.builder().ingredient(carne).quantity(n("100")).recipeUnit("g").build(),
                RecipeItem.builder().ingredient(tortilla).quantity(n("2")).recipeUnit("pieza").build());
        taco.setRecipeItems(new java.util.ArrayList<>(receta));

        Costos.Costo c = Costos.dePlatillo(taco, receta);
        assertEquals(0, c.valor().compareTo(n("23.00")), "0.1 kg × 200 + 2 × 1.5");
        assertTrue(c.completo());

        Product refresco = Product.builder().name("Refresco").trackStock(true).costoPromedio(n("12")).build();
        Product combo = Product.builder().name("Combo").isCombo(true).build();
        combo.getComboItems().add(ComboItem.builder().producto(taco).cantidad(3).build());
        combo.getComboItems().add(ComboItem.builder().producto(refresco).cantidad(1).build());
        assertEquals(0, Costos.dePlatillo(combo, null).valor().compareTo(n("81.00")), "3 × 23 + 12");

        tortilla.setCostoPromedio(null);
        Costos.Costo parcial = Costos.dePlatillo(taco, receta);
        assertFalse(parcial.completo());
        assertEquals(0, parcial.valor().compareTo(n("20.00")), "solo la carne");
    }

    @Test
    @DisplayName("Costo de una preparación: sus ingredientes entre lo que rinde")
    void costoDePreparacion() {
        Ingredient tomatillo = Ingredient.builder().name("Tomatillo").unitOfMeasure("kg").costoPromedio(n("30")).build();
        Ingredient chile = Ingredient.builder().name("Chile").unitOfMeasure("kg").costoPromedio(n("60")).build();
        Ingredient salsa = Ingredient.builder().name("Salsa verde").unitOfMeasure("l").esPreparado(true).rinde(n("1.5")).build();
        salsa.getComponentes().add(PreparacionComponente.builder().preparado(salsa).componente(tomatillo).cantidad(n("1")).unidad("kg").build());
        salsa.getComponentes().add(PreparacionComponente.builder().preparado(salsa).componente(chile).cantidad(n("150")).unidad("g").build());
        // (1 × 30 + 0.15 × 60) / 1.5 = 26
        assertEquals(0, Costos.dePreparacion(salsa).compareTo(n("26")));
        assertEquals(0, Costos.deIngrediente(salsa).compareTo(n("26")), "sin costo propio usa su receta");
    }
}
