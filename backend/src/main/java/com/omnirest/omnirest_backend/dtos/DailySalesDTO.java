package com.omnirest.omnirest_backend.dtos;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

public record DailySalesDTO(
    UUID restaurantId,
    UUID branchId,
    @JsonProperty("date") LocalDate saleDate,
    @JsonProperty("ordersCount") Long totalOrders,
    @JsonProperty("revenue") BigDecimal totalRevenue
) {
    @JsonProperty("saleDate")
    public LocalDate getSaleDate() {
        return saleDate;
    }

    @JsonProperty("totalRevenue")
    public BigDecimal getTotalRevenue() {
        return totalRevenue;
    }

    @JsonProperty("totalOrders")
    public Long getTotalOrders() {
        return totalOrders;
    }
}
