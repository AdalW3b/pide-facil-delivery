package com.omnirest.omnirest_backend.dtos;

import java.math.BigDecimal;

public record PeakHourDTO(
    Integer hourOfDay,
    Long totalOrders,
    BigDecimal totalRevenue
) {}
