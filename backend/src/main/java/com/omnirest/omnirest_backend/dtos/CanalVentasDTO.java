package com.omnirest.omnirest_backend.dtos;

import java.math.BigDecimal;

/**
 * Ventas por canal: SALON, PARA_LLEVAR o DOMICILIO, y por donde entro
 * (WEB, TELEFONO, WHATSAPP; null en pedidos viejos o en salon).
 */
public record CanalVentasDTO(
    String tipo,
    String origen,
    Long ordenes,
    BigDecimal ventas,
    BigDecimal envioCobrado,
    BigDecimal propinas
) {}
