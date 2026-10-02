package com.omnirest.omnirest_backend.domain.entities;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

/** Que tienda de Rappi es una sucursal. */
@Entity
@jakarta.persistence.Table(name = "rappi_tiendas")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RappiTienda {

    @Id
    @Column(name = "branch_id")
    private UUID branchId;

    /** El id de la tienda en Rappi (store_id). */
    @Column(name = "store_id", nullable = false, unique = true, length = 40)
    private String storeId;

    /** Lo ultimo que aviso Rappi en STORE_CONNECTIVITY. Null mientras no avise. */
    private Boolean habilitada;

    @Column(length = 300)
    private String mensaje;

    @Column(name = "ligada_en", insertable = false, updatable = false)
    private LocalDateTime ligadaEn;

    @Column(name = "actualizada_en")
    private LocalDateTime actualizadaEn;
}
