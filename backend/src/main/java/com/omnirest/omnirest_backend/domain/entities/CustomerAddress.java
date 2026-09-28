package com.omnirest.omnirest_backend.domain.entities;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Una direccion guardada del cliente. El pin (latitud/longitud) es obligatorio:
 * es lo que el repartidor abrira en su mapa, y sin el la direccion escrita no
 * alcanza para entregar.
 */
@Entity
@jakarta.persistence.Table(name = "customer_addresses")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CustomerAddress {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "customer_id", nullable = false)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private Customer customer;

    @Column(length = 60)
    private String alias;

    @Column(nullable = false, length = 300)
    private String direccion;

    @Column(length = 300)
    private String referencias;

    @Column(nullable = false, precision = 10, scale = 7)
    private BigDecimal latitud;

    @Column(nullable = false, precision = 10, scale = 7)
    private BigDecimal longitud;

    @Column(name = "es_principal")
    @Builder.Default
    private Boolean esPrincipal = false;

    @Builder.Default
    private Boolean activa = true;

    @Column(name = "creada_en", insertable = false, updatable = false)
    private LocalDateTime creadaEn;
}
