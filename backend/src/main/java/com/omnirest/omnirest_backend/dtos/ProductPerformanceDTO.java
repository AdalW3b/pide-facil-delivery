package com.omnirest.omnirest_backend.dtos;

import java.math.BigDecimal;
import java.util.UUID;

public record ProductPerformanceDTO(
    UUID productId,
    String productName,
    Long quantitySold,
    BigDecimal totalRevenue,
    String branchName
) {}
