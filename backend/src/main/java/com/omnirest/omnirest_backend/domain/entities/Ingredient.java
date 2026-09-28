package com.omnirest.omnirest_backend.domain.entities;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.util.UUID;

@Entity
@jakarta.persistence.Table(name = "ingredients")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Ingredient {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "restaurant_id", nullable = false)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private Restaurant restaurant;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(name = "unit_of_measure", length = 50)
    private String unitOfMeasure;

    @Transient
    private BigDecimal stock;

    @Builder.Default
    private Boolean active = true;
}
