package com.omnirest.omnirest_backend.dtos;

import java.math.BigDecimal;

/** Ordenes por dia de la semana y hora. diaSemana: 1 = lunes ... 7 = domingo. */
public record PeakHourDTO(
    Integer hourOfDay,
    Long totalOrders,
    BigDecimal totalRevenue,
    Integer diaSemana
) {}
