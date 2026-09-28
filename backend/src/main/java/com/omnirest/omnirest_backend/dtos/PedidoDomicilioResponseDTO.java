package com.omnirest.omnirest_backend.dtos;

import com.omnirest.omnirest_backend.domain.enums.DeliveryStatus;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * Comprobante del pedido. El {@code tokenSeguimiento} es lo que el cliente usa
 * para consultar su entrega sin necesidad de cuenta.
 */
public record PedidoDomicilioResponseDTO(
        UUID orderId,
        String tokenSeguimiento,
        DeliveryStatus deliveryStatus,
        BigDecimal subtotal,
        BigDecimal envioCobrado,
        BigDecimal total,
        BigDecimal distanciaKm,
        Integer minutosEstimados,
        BigDecimal cambioSugerido) {
}
