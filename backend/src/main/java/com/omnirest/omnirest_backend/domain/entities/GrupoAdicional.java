package com.omnirest.omnirest_backend.domain.entities;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/**
 * Un grupo de adicionales que el restaurante define una vez: "Extras",
 * "Tortilla", "Tamano". Con minimo y maximo sirve para extras opcionales y para
 * elecciones obligatorias.
 *
 * Se asigna a categorias enteras o a platillos sueltos; un platillo recibe los
 * grupos de su categoria mas los suyos.
 */
@Entity
@jakarta.persistence.Table(name = "grupos_adicionales")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class GrupoAdicional {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "restaurant_id", nullable = false)
    private UUID restaurantId;

    @Column(nullable = false, length = 60)
    private String nombre;

    @Builder.Default
    private Integer minimo = 0;

    @Builder.Default
    private Integer maximo = 1;

    @Builder.Default
    private Integer orden = 0;

    @Builder.Default
    private Boolean activo = true;

    @Column(name = "creado_en", insertable = false, updatable = false)
    private LocalDateTime creadoEn;

    @OneToMany(mappedBy = "grupo", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("orden ASC")
    @Builder.Default
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private List<Adicional> opciones = new ArrayList<>();

    @ManyToMany
    @JoinTable(name = "grupo_adicional_categorias",
            joinColumns = @JoinColumn(name = "grupo_id"),
            inverseJoinColumns = @JoinColumn(name = "category_id"))
    @Builder.Default
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private Set<Category> categorias = new HashSet<>();

    @ManyToMany
    @JoinTable(name = "grupo_adicional_productos",
            joinColumns = @JoinColumn(name = "grupo_id"),
            inverseJoinColumns = @JoinColumn(name = "product_id"))
    @Builder.Default
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private Set<Product> productos = new HashSet<>();

    /** Si este grupo aparece en la ficha de ese platillo. */
    public boolean aplicaA(Product producto) {
        if (producto == null) return false;
        boolean porProducto = productos.stream().anyMatch(p -> p.getId().equals(producto.getId()));
        boolean porCategoria = producto.getCategory() != null
                && categorias.stream().anyMatch(c -> c.getId().equals(producto.getCategory().getId()));
        return porProducto || porCategoria;
    }

    /** Hay que elegir exactamente uno: "Tortilla: maiz o harina". */
    public boolean esEleccionUnica() {
        return minimo != null && minimo >= 1 && maximo != null && maximo == 1;
    }
}
