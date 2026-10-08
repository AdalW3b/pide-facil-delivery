package com.omnirest.omnirest_backend.domain.entities;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;

@Entity
@jakarta.persistence.Table(name = "branch_ingredient_stocks")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class BranchIngredientStock {

    @EmbeddedId
    private BranchIngredientStockKey id;

    @ManyToOne(fetch = FetchType.LAZY)
    @MapsId("branchId")
    @JoinColumn(name = "branch_id")
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private Branch branch;

    @ManyToOne(fetch = FetchType.LAZY)
    @MapsId("ingredientId")
    @JoinColumn(name = "ingredient_id")
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private Ingredient ingredient;

    @Column(nullable = false, precision = 10, scale = 3)
    @Builder.Default
    private BigDecimal stock = BigDecimal.ZERO;

    /** Lo que le cuesta a esta sucursal, promedio ponderado. Null = sin costo propio todavia. */
    @Column(name = "costo_promedio", precision = 12, scale = 4)
    private BigDecimal costoPromedio;

    /** El minimo de esta sucursal. Null = el general del ingrediente. */
    @Column(precision = 12, scale = 3)
    private BigDecimal minimo;
}
