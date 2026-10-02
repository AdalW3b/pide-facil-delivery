package com.omnirest.omnirest_backend.domain.entities;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

/** Como se pago (parte de) una cuenta. Una cuenta puede llevar varios. */
@Entity
@jakarta.persistence.Table(name = "pagos")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Pago {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "order_id", nullable = false)
    private UUID orderId;

    @Column(name = "turno_id", nullable = false)
    private UUID turnoId;

    @Column(name = "payment_method_id")
    private UUID paymentMethodId;

    /** El nombre del metodo al cobrar, para que el arqueo no cambie si lo renombran. */
    @Column(nullable = false, length = 100)
    private String metodo;

    @Column(name = "es_efectivo", nullable = false)
    private Boolean esEfectivo;

    /** Lo que se abona a la cuenta, sin propina. */
    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal monto;

    @Column(nullable = false, precision = 12, scale = 2)
    @Builder.Default
    private BigDecimal propina = BigDecimal.ZERO;

    /** Solo efectivo: con cuanto pago el cliente. */
    @Column(precision = 12, scale = 2)
    private BigDecimal recibido;

    /** Solo efectivo: cuanto se le regreso. */
    @Column(precision = 12, scale = 2)
    private BigDecimal cambio;

    @Column(name = "cobrado_por", length = 120)
    private String cobradoPor;

    @Column(name = "creado_en", insertable = false, updatable = false)
    private LocalDateTime creadoEn;
}
