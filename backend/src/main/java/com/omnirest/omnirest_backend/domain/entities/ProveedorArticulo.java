package com.omnirest.omnirest_backend.domain.entities;

import jakarta.persistence.*;
import lombok.*;

import java.util.UUID;

/** Un articulo que surte un proveedor: un ingrediente o un producto terminado. */
@Entity
@jakarta.persistence.Table(name = "proveedor_articulos")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ProveedorArticulo {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "proveedor_id")
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private Proveedor proveedor;

    @Column(name = "ingredient_id")
    private UUID ingredientId;

    @Column(name = "product_id")
    private UUID productId;
}
