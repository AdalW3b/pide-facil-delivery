package com.omnirest.omnirest_backend.domain.entities;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@jakarta.persistence.Table(name = "customers")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Customer {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "restaurant_id", nullable = false)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private Restaurant restaurant;

    @Column(name = "phone_number", nullable = false)
    private String phoneNumber;

    @Column(nullable = false)
    private String name;

    @Column(name = "total_visits")
    @Builder.Default
    private Integer totalVisits = 1;

    @Column(name = "last_visit")
    private LocalDateTime lastVisit;

    @Column(name = "created_at", insertable = false, updatable = false)
    private LocalDateTime createdAt;

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
