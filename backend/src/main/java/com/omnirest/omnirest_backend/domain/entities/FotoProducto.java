package com.omnirest.omnirest_backend.domain.entities;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

/** La foto de un platillo, en los dos tamaños que usa el menu. */
@Entity
@jakarta.persistence.Table(name = "fotos_producto")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class FotoProducto {

    @Id
    @Column(name = "product_id")
    private UUID productId;

    @Column(nullable = false, columnDefinition = "bytea")
    @ToString.Exclude
    private byte[] grande;

    @Column(nullable = false, columnDefinition = "bytea")
    @ToString.Exclude
    private byte[] miniatura;

    @Column(nullable = false, length = 20)
    @Builder.Default
    private String tipo = "image/jpeg";

    @Column(name = "actualizado_en", nullable = false)
    private LocalDateTime actualizadoEn;
}
