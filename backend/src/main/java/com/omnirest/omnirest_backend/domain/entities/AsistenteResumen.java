package com.omnirest.omnirest_backend.domain.entities;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

/** El resumen del día de una sucursal, escrito por el asistente. */
@Entity
@jakarta.persistence.Table(name = "asistente_resumenes")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AsistenteResumen {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "restaurant_id", nullable = false)
    private UUID restaurantId;

    @Column(name = "branch_id", nullable = false)
    private UUID branchId;

    @Column(nullable = false)
    private LocalDate dia;

    @Column(nullable = false, columnDefinition = "text")
    private String contenido;

    @Column(name = "creado_en", insertable = false, updatable = false)
    private LocalDateTime creadoEn;
}
