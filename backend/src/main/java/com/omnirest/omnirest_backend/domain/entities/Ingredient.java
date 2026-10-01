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

    /** Por debajo de esto se avisa que queda poco. Null = sin alerta. */
    @Column(precision = 12, scale = 3)
    private BigDecimal minimo;

    /** Costo por unidad del inventario (kg, l, pieza). Null = sin costo capturado. */
    @Column(name = "costo_promedio", precision = 12, scale = 4)
    private BigDecimal costoPromedio;

    /** Donde se guarda, para contarlo por zona: "Refri", "Almacén". */
    @Column(length = 40)
    private String zona;

    /** Se hace en la cocina con otros ingredientes (salsa, frijoles). */
    @Column(name = "es_preparado", nullable = false)
    @Builder.Default
    private Boolean esPreparado = false;

    /** Cuanto sale de una tanda de su receta, en su propia unidad. */
    @Column(precision = 12, scale = 3)
    private BigDecimal rinde;

    @OneToMany(mappedBy = "preparado", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @Builder.Default
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private java.util.List<PreparacionComponente> componentes = new java.util.ArrayList<>();
}
