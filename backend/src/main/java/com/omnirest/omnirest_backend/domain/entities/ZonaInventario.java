package com.omnirest.omnirest_backend.domain.entities;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

/** Un lugar donde se guarda mercancía: "Refri", "Almacén", "Barra". Se da de alta y luego se elige. */
@Entity
@jakarta.persistence.Table(name = "zonas_inventario")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ZonaInventario {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "restaurant_id", nullable = false)
    private UUID restaurantId;

    @Column(nullable = false, length = 40)
    private String nombre;

    @Column(nullable = false)
    @Builder.Default
    private Integer orden = 0;

    @Column(name = "creado_en", nullable = false)
    @Builder.Default
    private LocalDateTime creadoEn = LocalDateTime.now();
}
