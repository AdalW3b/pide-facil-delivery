package com.omnirest.omnirest_backend.domain.entities;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Lo que un cliente va pidiendo por WhatsApp antes de confirmar. El bot lo
 * llena platillo por platillo y, cuando el cliente dice que si, se manda a
 * cocina completo. Asi el pedido no depende de lo que recuerde la IA.
 */
@Entity
@jakarta.persistence.Table(name = "carritos_bot")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CarritoBot {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "branch_id", nullable = false)
    private UUID branchId;

    /** Canonico (TelefonoMx): el mismo cliente escriba como escriba su numero. */
    @Column(nullable = false, length = 20)
    private String telefono;

    @Column(name = "table_number")
    private Integer tableNumber;

    @Column(name = "actualizado_en", nullable = false)
    private LocalDateTime actualizadoEn;

    @OneToMany(mappedBy = "carrito", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.EAGER)
    @OrderBy("creadoEn ASC")
    @Builder.Default
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private List<CarritoBotItem> items = new ArrayList<>();
}
