package com.omnirest.omnirest_backend.domain.entities;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

/** Una devolucion (total o parcial) de un cobro en linea. */
@Entity
@jakarta.persistence.Table(name = "reembolsos_linea")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ReembolsoLinea {

    public enum Estado { PENDIENTE, HECHO, FALLIDO }

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "transaccion_id", nullable = false)
    private UUID transaccionId;

    @Column(name = "stripe_refund_id", length = 80, unique = true)
    private String stripeRefundId;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal monto;

    @Column(length = 300)
    private String motivo;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private Estado estado = Estado.PENDIENTE;

    @Column(name = "hecho_por", length = 120)
    private String hechoPor;

    @Column(name = "creado_en", nullable = false, updatable = false)
    @Builder.Default
    private LocalDateTime creadoEn = LocalDateTime.now();
}
