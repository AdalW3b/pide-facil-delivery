package com.omnirest.omnirest_backend.dtos;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

import java.util.List;
import java.util.UUID;

public record PedidoDomicilioItemDTO(
        @NotNull UUID productId,
        @NotNull @Positive Integer quantity,
        String specialInstructions,
        /** Ids de los adicionales elegidos. El precio lo pone el servidor. */
        List<UUID> adicionales) {
}
