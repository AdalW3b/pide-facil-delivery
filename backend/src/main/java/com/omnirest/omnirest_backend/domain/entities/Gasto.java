package com.omnirest.omnirest_backend.domain.entities;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

/** Un gasto que no es compra de mercancia: renta, luz, nomina, mantenimiento… */
@Entity
@jakarta.persistence.Table(name = "gastos")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Gasto {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "branch_id", nullable = false)
    private UUID branchId;

    @Column(nullable = false, length = 20)
    private String categoria;

    @Column(nullable = false, length = 120)
    private String concepto;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal monto;

    /** Cuando se pago. */
    @Column(nullable = false)
    private LocalDate fecha;

    /** CAJA, TRANSFERENCIA o TARJETA. */
    @Column(name = "forma_pago", nullable = false, length = 15)
    private String formaPago;

    @Column(length = 300)
    private String nota;

    @Column(name = "gasto_fijo_id")
    private UUID gastoFijoId;

    @Column(name = "movimiento_caja_id")
    private UUID movimientoCajaId;

    @Column(length = 100)
    private String usuario;

    @Column(name = "creado_en", nullable = false)
    @Builder.Default
    private LocalDateTime creadoEn = LocalDateTime.now();

    @Column(name = "anulado_en")
    private LocalDateTime anuladoEn;

    @Column(name = "anulado_por", length = 100)
    private String anuladoPor;
}
