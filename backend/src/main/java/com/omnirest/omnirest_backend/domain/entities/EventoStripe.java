package com.omnirest.omnirest_backend.domain.entities;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

/**
 * Un evento de Stripe ya verificado, guardado antes de procesarlo. Su ID es el
 * de Stripe: si Stripe lo manda otra vez, no se procesa dos veces.
 */
@Entity
@jakarta.persistence.Table(name = "eventos_stripe")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class EventoStripe {

    public enum Estado { PENDIENTE, PROCESANDO, PROCESADO, IGNORADO, FALLIDO }

    @Id
    @Column(length = 80)
    private String id;

    @Column(nullable = false, length = 80)
    private String tipo;

    /** La cuenta conectada que lo origino (acct_...); vacio si es de la plataforma. */
    @Column(length = 60)
    private String cuenta;

    @Column(nullable = false)
    private Boolean livemode;

    @Column(nullable = false, columnDefinition = "text")
    private String payload;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 12)
    private Estado estado;

    @Column(nullable = false)
    private Integer intentos;

    @Column(name = "proximo_intento", nullable = false)
    private LocalDateTime proximoIntento;

    @Column(length = 500)
    private String error;

    @Column(name = "recibido_en", nullable = false)
    private LocalDateTime recibidoEn;

    @Column(name = "procesado_en")
    private LocalDateTime procesadoEn;
}
