package com.omnirest.omnirest_backend.domain.entities;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.util.UUID;

/** Una opcion dentro de un grupo: "Carne extra +$25", "Sin cebolla". */
@Entity
@jakarta.persistence.Table(name = "adicionales")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Adicional {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "grupo_id", nullable = false)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private GrupoAdicional grupo;

    @Column(nullable = false, length = 60)
    private String nombre;

    @Column(nullable = false, precision = 10, scale = 2)
    @Builder.Default
    private BigDecimal precio = BigDecimal.ZERO;

    @Builder.Default
    private Integer orden = 0;

    /** false = agotado hoy: se ve en la ficha pero no se puede elegir. */
    @Builder.Default
    private Boolean activo = true;

    /**
     * Ingrediente que gasta, opcional: "Carne extra" saca pastor del
     * inventario. La cantidad va en la unidad en que se lleva el ingrediente.
     */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "ingredient_id")
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private Ingredient ingrediente;

    @Column(name = "cantidad_ingrediente", precision = 10, scale = 3)
    private BigDecimal cantidadIngrediente;

    public boolean gastaInventario() {
        return ingrediente != null && cantidadIngrediente != null && cantidadIngrediente.signum() > 0;
    }
}
