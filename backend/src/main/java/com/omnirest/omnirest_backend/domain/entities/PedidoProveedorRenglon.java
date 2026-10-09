package com.omnirest.omnirest_backend.domain.entities;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.util.UUID;

/** Un articulo del pedido, como se pidio ("2 caja de 24") y cuanto llego. */
@Entity
@jakarta.persistence.Table(name = "pedido_proveedor_renglones")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PedidoProveedorRenglon {

    public static final String FALTO = "FALTO";
    public static final String MAL_ESTADO = "MAL_ESTADO";

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "pedido_id")
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private PedidoProveedor pedido;

    @Column(name = "ingredient_id")
    private UUID ingredientId;

    @Column(name = "product_id")
    private UUID productId;

    @Column(nullable = false, precision = 12, scale = 3)
    private BigDecimal cantidad;

    /** Unidad suelta si no se pidio en una presentacion. */
    @Column(length = 20)
    private String unidad;

    @Column(name = "presentacion_id")
    private UUID presentacionId;

    /** "2 caja de 24 Coca-Cola 355 ml", tal como salio en el mensaje. */
    @Column(nullable = false, length = 200)
    private String descripcion;

    /** "10 kg", "2 caja de 24": va en negritas en el mensaje. Null en los de antes. */
    @Column(name = "cantidad_texto", length = 80)
    private String cantidadTexto;

    /** "Arrachera". Null en los de antes. */
    @Column(length = 120)
    private String articulo;

    /** Cuanto llego, en la misma unidad o presentacion en que se pidio. */
    @Column(precision = 12, scale = 3)
    private BigDecimal recibido;

    /** FALTO o MAL_ESTADO, si llego menos. */
    @Column(length = 12)
    private String motivo;

    @Column(nullable = false)
    @Builder.Default
    private Integer orden = 0;
}
