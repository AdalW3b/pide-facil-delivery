package com.omnirest.omnirest_backend.dtos;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * Un platillo vendido en el periodo. El costo es el de hoy (receta por costo
 * promedio); null si el platillo no lleva inventario o no tiene costo.
 */
public record ProductPerformanceDTO(
    UUID productId,
    String productName,
    Long quantitySold,
    BigDecimal totalRevenue,
    String branchName,
    String categoria,
    BigDecimal costoUnitario,
    BigDecimal costoTotal,
    BigDecimal utilidad,
    Double margenPorcentaje,
    boolean costoCompleto
) {}
