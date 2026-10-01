package com.omnirest.omnirest_backend.dtos;

import java.math.BigDecimal;

/**
 * Resumen del periodo. Los porcentajes comparan contra el periodo anterior del
 * mismo largo; son null cuando no hay con que comparar (historico completo).
 *
 * "Ventas" es lo que se cobro de comida: el envio y la propina van aparte
 * porque no son del restaurante (el envio es del repartidor o lo absorbe).
 */
public record AnalyticsSummaryDTO(
    BigDecimal totalSalesToday,
    Double salesGrowthPercentage,
    /** Cuentas de mesa cobradas (cada vez que se ocupo una mesa). */
    Long tablesServedToday,
    Double tablesGrowthPercentage,
    BigDecimal averageTicket,
    Double ticketGrowthPercentage,
    Long totalOrdersToday,
    Double ordersGrowthPercentage,
    BigDecimal envioCobrado,
    BigDecimal propinas,
    Long canceladas,
    /** Lo que costo hacer lo vendido, con los costos de hoy. */
    BigDecimal costoVendido,
    BigDecimal utilidadBruta,
    Double margenPorcentaje,
    /** False si algun platillo vendido no tiene costo: la utilidad sale de mas. */
    boolean costoCompleto,
    /** Platillos vendidos sin costo capturado. */
    int platillosSinCosto
) {}
