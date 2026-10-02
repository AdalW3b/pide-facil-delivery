package com.omnirest.omnirest_backend.domain.entities;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

/** Una tablet activada como kiosko en una sucursal. */
@Entity
@jakarta.persistence.Table(name = "kioscos")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Kiosko {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "branch_id", nullable = false)
    private UUID branchId;

    @Column(nullable = false, length = 60)
    private String nombre;

    /** SHA-256 del token que guarda la tablet. El token en si no se guarda. */
    @Column(name = "token_hash", nullable = false, unique = true, length = 64)
    private String tokenHash;

    @Column(nullable = false)
    @Builder.Default
    private Boolean activo = true;

    @Column(name = "creado_por", length = 120)
    private String creadoPor;

    @Column(name = "creado_en", insertable = false, updatable = false)
    private LocalDateTime creadoEn;

    @Column(name = "ultimo_uso")
    private LocalDateTime ultimoUso;
}
