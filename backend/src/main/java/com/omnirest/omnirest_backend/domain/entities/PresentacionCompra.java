package com.omnirest.omnirest_backend.domain.entities;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * Como lo vende el proveedor: "caja de 24" = 24 piezas, "costal" = 20 kg. El
 * factor va en la unidad en que se lleva el inventario del articulo.
 */
@Entity
@jakarta.persistence.Table(name = "presentaciones_compra")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PresentacionCompra {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "ingredient_id")
    private UUID ingredientId;

    @Column(name = "product_id")
    private UUID productId;

    @Column(nullable = false, length = 60)
    private String nombre;

    @Column(nullable = false, precision = 12, scale = 3)
    private BigDecimal factor;
}
