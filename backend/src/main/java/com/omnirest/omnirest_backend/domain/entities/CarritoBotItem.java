package com.omnirest.omnirest_backend.domain.entities;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;

/** Un platillo del carrito del bot, con sus adicionales por nombre. */
@Entity
@jakarta.persistence.Table(name = "carrito_bot_items")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CarritoBotItem {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "carrito_id", nullable = false)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private CarritoBot carrito;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "product_id", nullable = false)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private Product product;

    @Column(nullable = false)
    private Integer cantidad;

    /** Un adicional por linea, tal como lo dijo el cliente ("Harina", "Carne extra"). */
    @Column(columnDefinition = "text")
    private String adicionales;

    @Column(length = 300)
    private String instrucciones;

    @Column(name = "creado_en", nullable = false)
    private LocalDateTime creadoEn;

    public List<String> listaDeAdicionales() {
        if (adicionales == null || adicionales.isBlank()) return List.of();
        return Arrays.stream(adicionales.split("\n")).map(String::trim).filter(s -> !s.isEmpty()).toList();
    }
}
