package com.omnirest.omnirest_backend.domain.entities;

import com.omnirest.omnirest_backend.domain.enums.TipoMovimiento;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Un cambio en las existencias de un ingrediente o de un producto terminado.
 * "cantidad" es lo que cambio (negativo = salio), en la unidad del inventario;
 * "saldo" es como quedo despues.
 */
@Entity
@jakarta.persistence.Table(name = "movimientos_inventario")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MovimientoInventario {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "branch_id", nullable = false)
    private UUID branchId;

    @Column(name = "ingredient_id")
    private UUID ingredientId;

    @Column(name = "product_id")
    private UUID productId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 15)
    private TipoMovimiento tipo;

    @Column(nullable = false, precision = 12, scale = 3)
    private BigDecimal cantidad;

    @Column(nullable = false, precision = 12, scale = 3)
    private BigDecimal saldo;

    @Column(name = "costo_unitario", precision = 12, scale = 4)
    private BigDecimal costoUnitario;

    @Column(length = 120)
    private String proveedor;

    @Column(length = 300)
    private String nota;

    @Column(name = "order_id")
    private UUID orderId;

    /** Compra, transferencia o produccion a la que pertenece. */
    @Column(name = "grupo_id")
    private UUID grupoId;

    @Column(length = 100)
    private String usuario;

    @Column(name = "creado_en", nullable = false)
    @Builder.Default
    private LocalDateTime creadoEn = LocalDateTime.now();
}
