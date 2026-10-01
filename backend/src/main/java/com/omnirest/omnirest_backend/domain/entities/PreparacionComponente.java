package com.omnirest.omnirest_backend.domain.entities;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * Un renglon de la receta de un ingrediente preparado: "1 kg de tomatillo" en
 * la salsa verde. La cantidad es por tanda; cuanto sale de la tanda lo dice
 * {@link Ingredient#getRinde()}.
 */
@Entity
@jakarta.persistence.Table(name = "preparacion_componentes")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PreparacionComponente {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "preparado_id", nullable = false)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private Ingredient preparado;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "componente_id", nullable = false)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private Ingredient componente;

    @Column(nullable = false, precision = 12, scale = 3)
    private BigDecimal cantidad;

    /** Como se escribio (g, kg...). Null = la del componente. */
    @Column(length = 20)
    private String unidad;
}
