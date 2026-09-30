package com.omnirest.omnirest_backend.domain.entities;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * Lo que desconto una linea del pedido de un ingrediente (o de un producto
 * terminado), ya multiplicado por la cantidad. Si se cancela se devuelve esto,
 * aunque la receta haya cambiado entre tanto.
 */
@Entity
@jakarta.persistence.Table(name = "order_item_consumos")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class OrderItemConsumo {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "order_item_id", nullable = false)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private OrderItem orderItem;

    @Column(name = "ingredient_id")
    private UUID ingredientId;

    @Column(name = "product_id")
    private UUID productId;

    @Column(nullable = false, precision = 12, scale = 3)
    private BigDecimal cantidad;
}
