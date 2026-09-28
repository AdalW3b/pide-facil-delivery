package com.omnirest.omnirest_backend.domain.entities;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Un repartidor del restaurante. No tiene cuenta ni contrasena: se registra
 * solo, con su numero de WhatsApp, la primera vez que abre el enlace de una
 * entrega. A partir de ahi queda identificado para el pago y los reportes.
 */
@Entity
@jakarta.persistence.Table(name = "drivers")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Driver {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "restaurant_id", nullable = false)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private Restaurant restaurant;

    @Column(nullable = false, length = 120)
    private String nombre;

    @Column(name = "phone_number", nullable = false, length = 20)
    private String phoneNumber;

    @Column(length = 40)
    private String vehiculo;

    @Builder.Default
    private Boolean activo = true;

    @Column(name = "registrado_en", insertable = false, updatable = false)
    private LocalDateTime registradoEn;

    @Column(name = "ultima_entrega")
    private LocalDateTime ultimaEntrega;

    // ------------------------------------------------------------------
    // Cuenta
    // ------------------------------------------------------------------
    // Null mientras no abra cuenta: la ficha sigue sirviendo igual sin ella.

    @Column(name = "password_hash", length = 100)
    private String passwordHash;

    @Column(length = 160)
    private String email;

    @Column(name = "cuenta_creada_en")
    private LocalDateTime cuentaCreadaEn;

    @Column(name = "ultimo_acceso")
    private LocalDateTime ultimoAcceso;

    /** True si ya puede iniciar sesion. */
    public boolean tieneCuenta() {
        return passwordHash != null && !passwordHash.isBlank();
    }
}
