package com.omnirest.omnirest_backend.domain.entities;

import jakarta.persistence.*;
import lombok.*;
import java.util.List;
import java.util.UUID;

@Entity
@jakarta.persistence.Table(name = "categories")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Category {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "restaurant_id", nullable = false)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private Restaurant restaurant;

    @Column(nullable = false, length = 50)
    private String name;

    @Builder.Default
    private Boolean active = true;

    @OneToMany(mappedBy = "category", fetch = FetchType.LAZY, cascade = CascadeType.ALL)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private List<Product> products;
}
