package com.omnirest.omnirest_backend.domain.entities;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

/** Un cambio que hizo el operador dentro de una sesión de soporte. */
@Entity
@jakarta.persistence.Table(name = "acciones_soporte")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AccionSoporte {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "sesion_id", nullable = false)
    private UUID sesionId;

    @Column(nullable = false, length = 10)
    private String metodo;

    @Column(nullable = false, length = 300)
    private String ruta;

    @Column(name = "estado_http")
    private Integer estadoHttp;

    @Column(insertable = false, updatable = false)
    private LocalDateTime en;
}
