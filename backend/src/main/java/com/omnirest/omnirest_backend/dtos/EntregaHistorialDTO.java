package com.omnirest.omnirest_backend.dtos;

import com.omnirest.omnirest_backend.domain.enums.DeliveryStatus;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

/** Una entrega como la ve el repartidor en su historial. */
public record EntregaHistorialDTO(
        UUID orderId,
        String token,
        DeliveryStatus estado,
        String sucursal,
        String direccion,
        BigDecimal distanciaKm,
        /** Lo que el negocio le pago por esta entrega. */
        BigDecimal tuPago,
        /** Lo que le cobro al cliente, propina incluida. */
        BigDecimal cobrado,
        /** La propina del cliente: es del repartidor. */
        BigDecimal propina,
        LocalDateTime asignadoEn,
        LocalDateTime entregadoEn) {
}
