package com.omnirest.omnirest_backend.domain.entities;

import jakarta.persistence.*;
import lombok.*;

@Entity
@jakarta.persistence.Table(name = "branch_product_stocks")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class BranchProductStock {

    @EmbeddedId
    private BranchProductStockKey id;

    @ManyToOne(fetch = FetchType.LAZY)
    @MapsId("branchId")
    @JoinColumn(name = "branch_id")
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private Branch branch;

    @ManyToOne(fetch = FetchType.LAZY)
    @MapsId("productId")
    @JoinColumn(name = "product_id")
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private Product product;

    @Column(nullable = false)
    @Builder.Default
    private Integer stock = 0;
}
