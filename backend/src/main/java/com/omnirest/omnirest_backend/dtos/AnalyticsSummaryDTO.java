package com.omnirest.omnirest_backend.dtos;

import java.math.BigDecimal;

public record AnalyticsSummaryDTO(
    BigDecimal totalSalesToday,
    Double salesGrowthPercentage,
    Long tablesServedToday,
    Double tablesGrowthPercentage,
    BigDecimal averageTicket,
    Double ticketGrowthPercentage,
    Long totalOrdersToday,
    Double ordersGrowthPercentage
) {}
