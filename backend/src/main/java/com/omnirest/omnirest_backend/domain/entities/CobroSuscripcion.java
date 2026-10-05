package com.omnirest.omnirest_backend.domain.entities;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

/** Un cobro de la renta del sistema a un restaurante: por Stripe o en efectivo. */
@Entity
@jakarta.persistence.Table(name = "cobros_suscripcion")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CobroSuscripcion {

    public enum Metodo { STRIPE, EFECTIVO }

    public enum Estado { PAGADO, FALLIDO, ANULADO }

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "restaurant_id", nullable = false)
    private UUID restaurantId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 15)
    private Metodo metodo;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 15)
    private Estado estado;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal monto;

    @Column(nullable = false, length = 3)
    @Builder.Default
    private String moneda = "MXN";

    @Column(length = 30)
    private String plan;

    @Column(name = "periodo_desde")
    private LocalDate periodoDesde;

    @Column(name = "periodo_hasta")
    private LocalDate periodoHasta;

    /** La factura de Stripe (in_...) o el folio del recibo en efectivo. */
    @Column(length = 120)
    private String referencia;

    @Column(length = 300)
    private String notas;

    @Column(name = "registrado_por", length = 120)
    private String registradoPor;

    @Column(name = "pagado_en")
    private LocalDateTime pagadoEn;

    @Column(name = "creado_en", insertable = false, updatable = false)
    private LocalDateTime creadoEn;

    @Column(name = "anulado_motivo", length = 300)
    private String anuladoMotivo;
}
