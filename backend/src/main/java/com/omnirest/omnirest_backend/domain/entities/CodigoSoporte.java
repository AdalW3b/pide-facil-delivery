package com.omnirest.omnirest_backend.domain.entities;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

/** El código con que el dueño autoriza a soporte a hacer cambios. Sirve una vez. */
@Entity
@jakarta.persistence.Table(name = "codigos_soporte")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CodigoSoporte {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "restaurant_id", nullable = false)
    private UUID restaurantId;

    @Column(name = "codigo_hash", nullable = false, length = 64)
    private String codigoHash;

    @Column(name = "creado_por", length = 120)
    private String creadoPor;

    @Column(name = "creado_en", insertable = false, updatable = false)
    private LocalDateTime creadoEn;

    @Column(name = "expira_en", nullable = false)
    private LocalDateTime expiraEn;

    @Column(name = "usado_en")
    private LocalDateTime usadoEn;

    @Column(name = "sesion_id")
    private UUID sesionId;
}
