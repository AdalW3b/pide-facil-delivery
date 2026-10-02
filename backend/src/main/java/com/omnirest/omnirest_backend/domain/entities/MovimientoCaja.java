package com.omnirest.omnirest_backend.domain.entities;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

/** Efectivo que entra o sale del cajon sin ser una venta: retiros, gastos, cambio. */
@Entity
@jakarta.persistence.Table(name = "movimientos_caja")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MovimientoCaja {

    public enum Tipo { ENTRADA, SALIDA }

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "turno_id", nullable = false)
    private UUID turnoId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private Tipo tipo;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal monto;

    @Column(nullable = false, length = 200)
    private String concepto;

    @Column(length = 120)
    private String por;

    @Column(name = "creado_en", insertable = false, updatable = false)
    private LocalDateTime creadoEn;
}
