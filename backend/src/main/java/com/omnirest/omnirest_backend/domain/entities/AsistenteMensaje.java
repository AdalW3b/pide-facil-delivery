package com.omnirest.omnirest_backend.domain.entities;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

/** Una pregunta al asistente y su respuesta. */
@Entity
@jakarta.persistence.Table(name = "asistente_mensajes")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AsistenteMensaje {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "restaurant_id", nullable = false)
    private UUID restaurantId;

    @Column(name = "branch_id")
    private UUID branchId;

    @Column(name = "user_id")
    private UUID userId;

    @Column(nullable = false, columnDefinition = "text")
    private String pregunta;

    @Column(columnDefinition = "text")
    private String respuesta;

    @Column(length = 20)
    private String proveedor;

    @Column(length = 100)
    private String modelo;

    @Column(length = 500)
    private String herramientas;

    @Column(name = "tokens_entrada")
    private Long tokensEntrada;

    @Column(name = "tokens_salida")
    private Long tokensSalida;

    @Column(name = "creado_en", insertable = false, updatable = false)
    private LocalDateTime creadoEn;
}
