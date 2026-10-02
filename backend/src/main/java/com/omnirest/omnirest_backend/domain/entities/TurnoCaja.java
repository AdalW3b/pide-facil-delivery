package com.omnirest.omnirest_backend.domain.entities;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.UUID;

/**
 * Un turno de la caja de una sucursal: se abre con un fondo y se cierra con
 * el arqueo. Mientras {@code cerradoEn} es null, es la caja abierta.
 */
@Entity
@jakarta.persistence.Table(name = "turnos_caja")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TurnoCaja {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "branch_id", nullable = false)
    private UUID branchId;

    @Column(name = "abierto_por")
    private UUID abiertoPor;

    @Column(name = "abierto_por_nombre", length = 120)
    private String abiertoPorNombre;

    @Column(name = "abierto_en", nullable = false)
    private LocalDateTime abiertoEn;

    @Column(name = "fondo_inicial", nullable = false, precision = 12, scale = 2)
    private BigDecimal fondoInicial;

    @Column(name = "cerrado_por")
    private UUID cerradoPor;

    @Column(name = "cerrado_por_nombre", length = 120)
    private String cerradoPorNombre;

    @Column(name = "cerrado_en")
    private LocalDateTime cerradoEn;

    @Column(name = "efectivo_esperado", precision = 12, scale = 2)
    private BigDecimal efectivoEsperado;

    @Column(name = "efectivo_contado", precision = 12, scale = 2)
    private BigDecimal efectivoContado;

    /** Contado menos esperado: positivo sobra, negativo falta. */
    @Column(precision = 12, scale = 2)
    private BigDecimal diferencia;

    /** Billetes y monedas contados: denominacion -> piezas. Null si se capturo el total. */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private Map<String, Integer> conteo;

    @Column(length = 500)
    private String notas;

    public boolean abierto() {
        return cerradoEn == null;
    }
}
