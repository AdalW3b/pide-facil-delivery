package com.omnirest.omnirest_backend.domain.entities;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import lombok.*;

import java.io.Serializable;
import java.util.UUID;

@Embeddable
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class BranchProductStockKey implements Serializable {

    @Column(name = "branch_id")
    private UUID branchId;

    @Column(name = "product_id")
    private UUID productId;
}
