package com.omnirest.omnirest_backend.domain.entities;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

/** Quien hizo que en los pagos en linea: conectar, activar, comision, reembolsos. */
@Entity
@jakarta.persistence.Table(name = "bitacora_pagos_linea")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class BitacoraPagoLinea {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "restaurant_id", nullable = false)
    private UUID restaurantId;

    @Column(nullable = false, length = 40)
    private String accion;

    @Column(length = 500)
    private String detalle;

    @Column(length = 120)
    private String usuario;

    @Column(insertable = false, updatable = false)
    private LocalDateTime en;
}
