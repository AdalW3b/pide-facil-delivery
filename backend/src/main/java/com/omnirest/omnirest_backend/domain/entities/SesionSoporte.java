package com.omnirest.omnirest_backend.domain.entities;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

/** El operador entró a ver un restaurante, con un motivo. */
@Entity
@jakarta.persistence.Table(name = "sesiones_soporte")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SesionSoporte {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "restaurant_id", nullable = false)
    private UUID restaurantId;

    @Column(name = "operador_id")
    private UUID operadorId;

    @Column(name = "operador_nombre", length = 120)
    private String operadorNombre;

    @Column(nullable = false, length = 300)
    private String motivo;

    @Column(nullable = false)
    private LocalDateTime inicio;

    private LocalDateTime fin;

    /** Hasta cuando puede hacer cambios. Null o vencido: solo lectura. */
    @Column(name = "cambios_hasta")
    private LocalDateTime cambiosHasta;

    public boolean puedeCambiar(LocalDateTime ahora) {
        return cambiosHasta != null && cambiosHasta.isAfter(ahora);
    }
}
