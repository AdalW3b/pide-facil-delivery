package com.omnirest.omnirest_backend.domain.entities;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/** Quien le surte al restaurante. No se borra si tiene compras: se desactiva. */
@Entity
@jakarta.persistence.Table(name = "proveedores")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Proveedor {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "restaurant_id", nullable = false)
    private UUID restaurantId;

    @Column(nullable = false, length = 120)
    private String nombre;

    @Column(length = 120)
    private String contacto;

    @Column(length = 30)
    private String telefono;

    /** Cuantos dias da para pagar lo que se compra a credito. */
    @Column(name = "dias_credito", nullable = false)
    @Builder.Default
    private Integer diasCredito = 0;

    /** "LUN,JUE": los dias que visita. */
    @Column(name = "dias_visita", length = 40)
    private String diasVisita;

    @Column(length = 300)
    private String notas;

    @Column(nullable = false)
    @Builder.Default
    private Boolean activo = true;

    @Column(name = "creado_en", nullable = false)
    @Builder.Default
    private LocalDateTime creadoEn = LocalDateTime.now();

    /** Lo que surte. */
    @OneToMany(mappedBy = "proveedor", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @Builder.Default
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private List<ProveedorArticulo> articulos = new ArrayList<>();
}
