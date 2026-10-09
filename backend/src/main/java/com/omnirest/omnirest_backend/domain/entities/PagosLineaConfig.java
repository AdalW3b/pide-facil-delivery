package com.omnirest.omnirest_backend.domain.entities;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

/** La cuenta de Stripe conectada de un restaurante y como cobra en linea. */
@Entity
@jakarta.persistence.Table(name = "pagos_linea_config")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PagosLineaConfig {

    public enum EstadoCuenta {
        SIN_CONECTAR,
        /** Stripe todavia pide datos al dueno antes de dejarlo cobrar. */
        PENDIENTE,
        LISTA,
        /** Stripe detuvo los cobros; el motivo va en motivoEstado. */
        DETENIDA
    }

    @Id
    @Column(name = "restaurant_id")
    private UUID restaurantId;

    @Column(name = "stripe_account_id", length = 60, unique = true)
    private String stripeAccountId;

    @Enumerated(EnumType.STRING)
    @Column(name = "estado_cuenta", nullable = false, length = 20)
    @Builder.Default
    private EstadoCuenta estadoCuenta = EstadoCuenta.SIN_CONECTAR;

    @Column(name = "motivo_estado", length = 300)
    private String motivoEstado;

    @Column(nullable = false)
    @Builder.Default
    private Boolean activo = false;

    @Column(name = "modo_prueba", nullable = false)
    @Builder.Default
    private Boolean modoPrueba = true;

    @Column(name = "acepta_tarjeta", nullable = false)
    @Builder.Default
    private Boolean aceptaTarjeta = true;

    @Column(name = "acepta_efectivo", nullable = false)
    @Builder.Default
    private Boolean aceptaEfectivo = true;

    @Column(name = "acepta_en_tienda", nullable = false)
    @Builder.Default
    private Boolean aceptaEnTienda = true;

    /** Lo que se queda Pide Facil de cada pago. 0 = solo la renta. */
    @Column(name = "comision_plataforma_pct", nullable = false, precision = 5, scale = 2)
    @Builder.Default
    private BigDecimal comisionPlataformaPct = BigDecimal.ZERO;

    @Column(name = "conectado_en")
    private LocalDateTime conectadoEn;

    @Column(name = "actualizado_en", nullable = false)
    @Builder.Default
    private LocalDateTime actualizadoEn = LocalDateTime.now();
}
