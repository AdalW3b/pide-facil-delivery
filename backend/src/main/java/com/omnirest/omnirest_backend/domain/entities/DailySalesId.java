package com.omnirest.omnirest_backend.domain.entities;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.io.Serializable;
import java.time.LocalDate;
import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DailySalesId implements Serializable {
    private UUID restaurantId;
    private UUID branchId;
    private LocalDate saleDate;
}
