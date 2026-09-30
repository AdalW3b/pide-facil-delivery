package com.omnirest.omnirest_backend.domain.entities;

import jakarta.persistence.*;
import lombok.*;

import java.util.UUID;

/** Un platillo dentro de un combo: "4 × Taco al pastor". */
@Entity
@jakarta.persistence.Table(name = "combo_items")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ComboItem {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "combo_id", nullable = false)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private Product combo;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "product_id", nullable = false)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private Product producto;

    @Column(nullable = false)
    private Integer cantidad;

    @Builder.Default
    private Integer orden = 0;
}
