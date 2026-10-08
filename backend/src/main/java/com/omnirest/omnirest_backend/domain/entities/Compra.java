package com.omnirest.omnirest_backend.domain.entities;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

/** Una nota del proveedor: agrupa las entradas de mercancia que llegaron juntas. */
@Entity
@jakarta.persistence.Table(name = "compras")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Compra {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "branch_id", nullable = false)
    private UUID branchId;

    /** El nombre como quedo en la nota (se conserva aunque el proveedor cambie de nombre). */
    @Column(length = 120)
    private String proveedor;

    @Column(name = "proveedor_id")
    private UUID proveedorId;

    @Column(length = 40)
    private String folio;

    /** La fecha de la nota; puede ser anterior a cuando se capturo. */
    private java.time.LocalDate fecha;

    /** CAJA, TRANSFERENCIA o CREDITO. */
    @Column(name = "forma_pago", length = 15)
    private String formaPago;

    /** INCLUIDO, APARTE o SIN. */
    @Column(length = 10)
    private String iva;

    @Column(precision = 12, scale = 2)
    private BigDecimal subtotal;

    @Column(name = "iva_monto", precision = 12, scale = 2)
    private BigDecimal ivaMonto;

    private java.time.LocalDate vence;

    @Column(name = "pagada_en")
    private LocalDateTime pagadaEn;

    /** Quien pago lo comprado a credito, y como: CAJA o TRANSFERENCIA. */
    @Column(name = "pagada_por", length = 100)
    private String pagadaPor;

    @Column(name = "pago_forma", length = 15)
    private String pagoForma;

    /** La salida de efectivo con que se pago lo comprado a credito. */
    @Column(name = "pago_movimiento_caja_id")
    private UUID pagoMovimientoCajaId;

    /** El pedido al proveedor que se recibio con esta compra. */
    @Column(name = "pedido_id")
    private UUID pedidoId;

    @Column(length = 1000)
    private String detalle;

    @Column(name = "movimiento_caja_id")
    private UUID movimientoCajaId;

    @Column(name = "anulada_en")
    private LocalDateTime anuladaEn;

    @Column(name = "anulada_por", length = 100)
    private String anuladaPor;

    @Column(name = "motivo_anulacion", length = 300)
    private String motivoAnulacion;

    @Column(length = 300)
    private String nota;

    @Column(precision = 12, scale = 2)
    private BigDecimal total;

    @Column(length = 100)
    private String usuario;

    @Column(name = "creado_en", nullable = false)
    @Builder.Default
    private LocalDateTime creadoEn = LocalDateTime.now();
}
