package com.omnirest.omnirest_backend.domain.entities;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

/** Nombre, color y logo con que un restaurante se presenta a sus clientes y a su equipo. */
@Entity
@jakarta.persistence.Table(name = "marca_restaurante")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MarcaRestaurante {

    @Id
    @Column(name = "restaurant_id")
    private UUID restaurantId;

    @Column(length = 60)
    private String nombre;

    @Column(length = 7)
    private String color;

    @Column(columnDefinition = "bytea")
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private byte[] logo;

    @Column(name = "logo_version")
    private LocalDateTime logoVersion;

    @Column(name = "actualizado_en", nullable = false)
    private LocalDateTime actualizadoEn;
}
