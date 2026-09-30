package com.omnirest.omnirest_backend.dtos;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

import java.util.List;
import java.util.UUID;

public record PedidoDomicilioItemDTO(
        @NotNull UUID productId,
        @NotNull @Positive @jakarta.validation.constraints.Max(value = 99, message = "Máximo 99 piezas de un mismo platillo.") Integer quantity,
        @jakarta.validation.constraints.Size(max = 300) String specialInstructions,
        /** Ids de los adicionales elegidos. El precio lo pone el servidor. */
        List<UUID> adicionales) {
}
