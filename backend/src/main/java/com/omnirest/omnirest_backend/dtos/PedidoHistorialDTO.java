package com.omnirest.omnirest_backend.dtos;

import com.omnirest.omnirest_backend.domain.enums.DeliveryStatus;
import com.omnirest.omnirest_backend.domain.enums.OrderStatus;
import com.omnirest.omnirest_backend.domain.enums.OrderType;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/** Un pedido como lo ve el cliente en su historial. */
public record PedidoHistorialDTO(
        UUID orderId,
        String token,
        OrderType tipo,
        OrderStatus estado,
        DeliveryStatus estadoEntrega,
        LocalDateTime fecha,
        /** Null en los pedidos de salon. */
        String direccion,
        Integer mesa,
        List<String> platillos,
        BigDecimal comida,
        BigDecimal envio,
        BigDecimal total) {
}
