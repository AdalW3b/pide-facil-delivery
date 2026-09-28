package com.omnirest.omnirest_backend.domain.entities;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * Un adicional elegido en una linea del pedido, con nombre y precio congelados:
 * si manana cambia el precio del queso, los pedidos de ayer no cambian.
 *
 * Es el desglose, no el cobro: order_items.unit_price ya incluye estos precios.
 */
@Entity
@jakarta.persistence.Table(name = "order_item_adicionales")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class OrderItemAdicional {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "order_item_id", nullable = false)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private OrderItem orderItem;

    /** Puede quedar null si despues se borra el adicional del catalogo. */
    @Column(name = "adicional_id")
    private UUID adicionalId;

    @Column(name = "grupo_nombre", nullable = false, length = 60)
    private String grupoNombre;

    @Column(nullable = false, length = 60)
    private String nombre;

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal precio;

    /**
     * Lo que se desconto del inventario por cada unidad del platillo. Si se
     * cancela se devuelve exactamente esto, aunque el catalogo haya cambiado.
     */
    @Column(name = "ingredient_id")
    private UUID ingredientId;

    @Column(name = "cantidad_ingrediente", precision = 10, scale = 3)
    private BigDecimal cantidadIngrediente;
}
