package com.omnirest.omnirest_backend.domain.entities;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

/** Una nota del proveedor: agrupa las entradas de mercancia que llegaron juntas. */
@Entity
@jakarta.persistence.Table(name = "compras")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Compra {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "branch_id", nullable = false)
    private UUID branchId;

    @Column(length = 120)
    private String proveedor;

    @Column(length = 300)
    private String nota;

    @Column(precision = 12, scale = 2)
    private BigDecimal total;

    @Column(length = 100)
    private String usuario;

    @Column(name = "creado_en", nullable = false)
    @Builder.Default
    private LocalDateTime creadoEn = LocalDateTime.now();
}
