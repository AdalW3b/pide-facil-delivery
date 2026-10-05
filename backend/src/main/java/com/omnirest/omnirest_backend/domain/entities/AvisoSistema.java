package com.omnirest.omnirest_backend.domain.entities;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

/** Un aviso de la plataforma al dueño del restaurante: lo ve en la campana del panel. */
@Entity
@jakarta.persistence.Table(name = "avisos_sistema")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AvisoSistema {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "restaurant_id", nullable = false)
    private UUID restaurantId;

    /** SOPORTE, RENTA... para que el panel ponga el icono. */
    @Column(nullable = false, length = 20)
    private String tipo;

    @Column(nullable = false, length = 150)
    private String titulo;

    @Column(length = 500)
    private String detalle;

    @Column(name = "creado_en", insertable = false, updatable = false)
    private LocalDateTime creadoEn;

    @Column(name = "leido_en")
    private LocalDateTime leidoEn;
}
