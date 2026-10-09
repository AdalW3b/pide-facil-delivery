package com.omnirest.omnirest_backend.domain.entities;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Un area de la cocina con su propia pantalla: Cocina, Parrilla, Barra,
 * Postres… o Empaque, que junta lo de domicilio y para llevar.
 */
@Entity
@jakarta.persistence.Table(name = "areas_preparacion")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AreaPreparacion {

    public static final String PREPARACION = "PREPARACION";
    public static final String EMPAQUE = "EMPAQUE";

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "restaurant_id", nullable = false)
    private UUID restaurantId;

    @Column(nullable = false, length = 40)
    private String nombre;

    /** PREPARACION o EMPAQUE. */
    @Column(nullable = false, length = 12)
    @Builder.Default
    private String tipo = PREPARACION;

    @Column(nullable = false)
    @Builder.Default
    private Integer orden = 0;

    @Column(nullable = false)
    @Builder.Default
    private Boolean activa = true;

    /** A donde va lo que no tiene area asignada. */
    @Column(nullable = false)
    @Builder.Default
    private Boolean predeterminada = false;

    @Column(name = "creado_en", nullable = false)
    @Builder.Default
    private LocalDateTime creadoEn = LocalDateTime.now();
}
