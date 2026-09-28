package com.omnirest.omnirest_backend.dtos;

import java.math.BigDecimal;

public record TablePerformanceDTO(
    Integer tableNumber,
    Long totalOrders,
    BigDecimal totalRevenue,
    String branchName
) {}
