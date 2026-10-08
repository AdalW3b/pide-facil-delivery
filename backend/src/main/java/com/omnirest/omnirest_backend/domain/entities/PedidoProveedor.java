package com.omnirest.omnirest_backend.domain.entities;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/** Lo que se le pidio a un proveedor; al llegar se recibe contra lo pedido. */
@Entity
@jakarta.persistence.Table(name = "pedidos_proveedor")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PedidoProveedor {

    public static final String PENDIENTE = "PENDIENTE";
    public static final String RECIBIDO = "RECIBIDO";
    public static final String CANCELADO = "CANCELADO";

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "branch_id", nullable = false)
    private UUID branchId;

    @Column(name = "proveedor_id")
    private UUID proveedorId;

    /** El nombre como se pidio. */
    @Column(nullable = false, length = 120)
    private String proveedor;

    /** Para cuando se necesita. */
    private LocalDate para;

    @Column(length = 300)
    private String nota;

    /** PENDIENTE, RECIBIDO o CANCELADO. */
    @Column(nullable = false, length = 12)
    @Builder.Default
    private String estado = PENDIENTE;

    @Column(name = "compra_id")
    private UUID compraId;

    @Column(name = "creado_por", length = 100)
    private String creadoPor;

    @Column(name = "creado_en", nullable = false)
    @Builder.Default
    private LocalDateTime creadoEn = LocalDateTime.now();

    @Column(name = "cerrado_en")
    private LocalDateTime cerradoEn;

    @OneToMany(mappedBy = "pedido", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @OrderBy("orden ASC")
    @Builder.Default
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private List<PedidoProveedorRenglon> renglones = new ArrayList<>();
}
