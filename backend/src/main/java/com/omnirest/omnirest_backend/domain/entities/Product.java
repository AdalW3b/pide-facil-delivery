package com.omnirest.omnirest_backend.domain.entities;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

@Entity
@jakarta.persistence.Table(name = "products")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Product {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "category_id", nullable = false)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private Category category;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal price;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Builder.Default
    private Boolean active = true;

    @Column(name = "track_stock")
    @Builder.Default
    private Boolean trackStock = false;

    @Transient
    private Integer stock;

    @Column(name = "is_recipe")
    @Builder.Default
    private Boolean isRecipe = false;

    @OneToMany(mappedBy = "product", fetch = FetchType.LAZY, cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private List<RecipeItem> recipeItems = new java.util.ArrayList<>();
}
