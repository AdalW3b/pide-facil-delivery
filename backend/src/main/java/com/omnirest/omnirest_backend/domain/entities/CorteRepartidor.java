package com.omnirest.omnirest_backend.domain.entities;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

/** Un cuadre de caja: lo que el repartidor entrego contra lo que debia entregar. */
@Entity
@jakarta.persistence.Table(name = "cortes_repartidor")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CorteRepartidor {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "branch_id", nullable = false)
    private UUID branchId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "driver_id", nullable = false)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private Driver driver;

    @Column(name = "recibido_por")
    private UUID recibidoPor;

    @Column(name = "creado_en", nullable = false)
    private LocalDateTime creadoEn;

    @Column(nullable = false)
    private Integer entregas;

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal cobrado;

    @Column(name = "pago_repartidor", nullable = false, precision = 10, scale = 2)
    private BigDecimal pagoRepartidor;

    @Column(name = "pago_descontado", nullable = false)
    private Boolean pagoDescontado;

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal esperado;

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal recibido;

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal diferencia;

    @Column(length = 300)
    private String notas;
}
