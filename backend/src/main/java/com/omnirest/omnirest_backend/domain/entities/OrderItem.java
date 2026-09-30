package com.omnirest.omnirest_backend.domain.entities;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.util.UUID;
import com.omnirest.omnirest_backend.domain.enums.KitchenStatus;

@Entity
@jakarta.persistence.Table(name = "order_items")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class OrderItem {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "order_id", nullable = false)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private Order order;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "product_id", nullable = false)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private Product product;

    @Column(nullable = false)
    private Integer quantity;

    @Column(name = "unit_price", nullable = false, precision = 10, scale = 2)
    private BigDecimal unitPrice;

    @Column(name = "special_instructions", columnDefinition = "TEXT")
    private String specialInstructions;

    @Enumerated(EnumType.STRING)
    @Column(name = "kitchen_status", nullable = false)
    @Builder.Default
    private KitchenStatus kitchenStatus = KitchenStatus.PENDING;

    @Column(name = "ready_at")
    private java.time.LocalDateTime readyAt;

    /**
     * Lo que se eligio en la ficha del platillo. Se carga con subselect: una
     * sola consulta para todas las lineas, y sin fallar si se lee fuera de una
     * transaccion.
     */
    @OneToMany(mappedBy = "orderItem", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.EAGER)
    @org.hibernate.annotations.Fetch(org.hibernate.annotations.FetchMode.SUBSELECT)
    @Builder.Default
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private java.util.List<OrderItemAdicional> adicionales = new java.util.ArrayList<>();

    /** Si la linea es un combo: los platillos que llevaba al venderse. */
    @OneToMany(mappedBy = "orderItem", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.EAGER)
    @org.hibernate.annotations.Fetch(org.hibernate.annotations.FetchMode.SUBSELECT)
    @Builder.Default
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private java.util.List<OrderItemComponente> componentes = new java.util.ArrayList<>();

    /**
     * Lo que se muestra debajo del platillo, en cocina, en la cuenta y al
     * repartidor. Si es combo, primero lo que incluye: "Incluye: 4 × Taco al
     * pastor, 2 × Refresco". Despues los adicionales, agrupados: "Tortilla:
     * Harina", "Extras: Carne extra, Queso". Lista vacia si no lleva nada.
     */
    public java.util.List<String> adicionalesParaMostrar() {
        java.util.List<String> lineas = new java.util.ArrayList<>();
        if (componentes != null && !componentes.isEmpty()) {
            lineas.add("Incluye: " + componentes.stream()
                    .map(c -> c.getCantidad() + " × " + c.getNombre())
                    .collect(java.util.stream.Collectors.joining(", ")));
        }
        if (adicionales == null || adicionales.isEmpty()) return lineas;
        java.util.Map<String, java.util.List<String>> porGrupo = new java.util.LinkedHashMap<>();
        for (OrderItemAdicional a : adicionales) {
            porGrupo.computeIfAbsent(a.getGrupoNombre(), k -> new java.util.ArrayList<>()).add(a.getNombre());
        }
        porGrupo.forEach((grupo, nombres) -> lineas.add(grupo + ": " + String.join(", ", nombres)));
        return lineas;
    }
}
