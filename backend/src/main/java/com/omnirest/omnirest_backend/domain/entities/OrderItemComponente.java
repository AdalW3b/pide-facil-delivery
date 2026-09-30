package com.omnirest.omnirest_backend.domain.entities;

import jakarta.persistence.*;
import lombok.*;

import java.util.UUID;

/**
 * Un platillo de un combo vendido, congelado al momento de la venta: cocina
 * ve lo que se pidio y una cancelacion devuelve exactamente esto al
 * inventario, aunque despues cambie el combo.
 */
@Entity
@jakarta.persistence.Table(name = "order_item_componentes")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class OrderItemComponente {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "order_item_id", nullable = false)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private OrderItem orderItem;

    /** Puede quedar null si despues se borra el platillo del catalogo. */
    @Column(name = "product_id")
    private UUID productId;

    @Column(nullable = false, length = 100)
    private String nombre;

    /** Por cada combo de la linea. */
    @Column(nullable = false)
    private Integer cantidad;
}
