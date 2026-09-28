package com.omnirest.omnirest_backend.domain.entities;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Parametros de delivery de una sucursal: desde donde sale el repartidor, que
 * cobra por distancia, hasta donde llega y cuanto le paga al repartidor.
 *
 * Comparte la llave primaria con la sucursal: una sucursal tiene a lo mas una
 * configuracion.
 */
@Entity
@jakarta.persistence.Table(name = "branch_delivery_settings")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class BranchDeliverySettings {

    @Id
    @Column(name = "branch_id")
    private UUID branchId;

    @OneToOne(fetch = FetchType.LAZY)
    @MapsId
    @JoinColumn(name = "branch_id")
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private Branch branch;

    @Builder.Default
    private Boolean activo = false;

    @Column(precision = 10, scale = 7)
    private BigDecimal latitud;

    @Column(precision = 10, scale = 7)
    private BigDecimal longitud;

    @Column(name = "km_incluidos", precision = 5, scale = 2)
    @Builder.Default
    private BigDecimal kmIncluidos = new BigDecimal("3.00");

    @Column(name = "tarifa_base", precision = 10, scale = 2)
    @Builder.Default
    private BigDecimal tarifaBase = new BigDecimal("40.00");

    @Column(name = "pct_base_absorbe", precision = 4, scale = 3)
    @Builder.Default
    private BigDecimal pctBaseAbsorbe = new BigDecimal("1.000");

    @Column(name = "precio_km_extra", precision = 10, scale = 2)
    @Builder.Default
    private BigDecimal precioKmExtra = new BigDecimal("10.00");

    @Column(name = "pct_extra_absorbe", precision = 4, scale = 3)
    @Builder.Default
    private BigDecimal pctExtraAbsorbe = new BigDecimal("0.000");

    @Column(name = "redondeo_km", precision = 4, scale = 2)
    @Builder.Default
    private BigDecimal redondeoKm = new BigDecimal("1.00");

    @Column(name = "distancia_maxima_km", precision = 5, scale = 2)
    @Builder.Default
    private BigDecimal distanciaMaximaKm = new BigDecimal("8.00");

    /**
     * Mientras no haya servicio de rutas, la distancia real se estima
     * multiplicando la linea recta por este factor.
     */
    @Column(name = "factor_calles", precision = 4, scale = 2)
    @Builder.Default
    private BigDecimal factorCalles = new BigDecimal("1.30");

    @Column(name = "pedido_minimo", precision = 10, scale = 2)
    @Builder.Default
    private BigDecimal pedidoMinimo = BigDecimal.ZERO;

    @Column(name = "minutos_estimados")
    @Builder.Default
    private Integer minutosEstimados = 40;

    @Column(name = "grupo_repartidores", length = 120)
    private String grupoRepartidores;

    @Column(name = "pago_repartidor_fijo", precision = 10, scale = 2)
    @Builder.Default
    private BigDecimal pagoRepartidorFijo = new BigDecimal("12.00");

    @Column(name = "pago_repartidor_km", precision = 10, scale = 2)
    @Builder.Default
    private BigDecimal pagoRepartidorKm = new BigDecimal("6.00");

    @Column(name = "creado_en", insertable = false, updatable = false)
    private LocalDateTime creadoEn;

    @Column(name = "actualizado_en")
    private LocalDateTime actualizadoEn;

    /** True solo si el delivery esta prendido y la sucursal tiene su pin puesto. */
    public boolean listoParaRepartir() {
        return Boolean.TRUE.equals(activo) && latitud != null && longitud != null;
    }
}
