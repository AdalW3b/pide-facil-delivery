package com.omnirest.omnirest_backend.domain.entities;

import jakarta.persistence.*;
import lombok.*;

import java.util.UUID;

@Entity
@jakarta.persistence.Table(name = "payment_methods")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PaymentMethod {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "branch_id", nullable = false)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private Branch branch;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(columnDefinition = "TEXT")
    private String instructions;

    @Builder.Default
    @Column(nullable = false)
    private Boolean active = true;

    /** Lo que se cobra con este metodo entra al cajon y se cuenta en el arqueo. */
    @Builder.Default
    @Column(name = "es_efectivo", nullable = false)
    private Boolean esEfectivo = false;
}
