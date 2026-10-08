package com.omnirest.omnirest_backend.domain.entities;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

/** Un gasto que se repite cada mes (renta, luz, nomina): la pantalla avisa si falta pagarlo. */
@Entity
@jakarta.persistence.Table(name = "gastos_fijos")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class GastoFijo {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "branch_id", nullable = false)
    private UUID branchId;

    @Column(nullable = false, length = 20)
    private String categoria;

    @Column(nullable = false, length = 120)
    private String concepto;

    /** Lo de siempre; al pagarlo se puede cambiar. */
    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal monto;

    /** Que dia del mes se paga (31 = el ultimo dia en meses mas cortos). */
    @Column(name = "dia_del_mes", nullable = false)
    private Integer diaDelMes;

    @Column(nullable = false)
    @Builder.Default
    private Boolean activo = true;

    @Column(name = "creado_en", nullable = false)
    @Builder.Default
    private LocalDateTime creadoEn = LocalDateTime.now();
}
