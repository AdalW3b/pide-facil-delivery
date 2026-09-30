package com.omnirest.omnirest_backend.domain.entities;

import jakarta.persistence.*;
import lombok.*;

import java.io.Serializable;
import java.time.LocalDateTime;
import java.util.UUID;

/** Un platillo que se acabo hoy en una sucursal, marcado a mano. */
@Entity
@jakarta.persistence.Table(name = "productos_agotados")
@IdClass(ProductoAgotado.Clave.class)
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ProductoAgotado {

    @Id
    @Column(name = "branch_id")
    private UUID branchId;

    @Id
    @Column(name = "product_id")
    private UUID productId;

    @Column(nullable = false)
    @Builder.Default
    private LocalDateTime desde = LocalDateTime.now();

    @Column(length = 100)
    private String por;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Clave implements Serializable {
        private UUID branchId;
        private UUID productId;
    }
}
