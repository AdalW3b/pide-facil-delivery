package com.omnirest.omnirest_backend.domain.entities;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.util.UUID;

@Entity
@jakarta.persistence.Table(name = "recipe_items")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RecipeItem {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "product_id", nullable = false)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private Product product;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "ingredient_id", nullable = false)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private Ingredient ingredient;

    @Column(nullable = false, precision = 10, scale = 3)
    private BigDecimal quantity;

    @Column(name = "recipe_unit", length = 50)
    private String recipeUnit;
}
