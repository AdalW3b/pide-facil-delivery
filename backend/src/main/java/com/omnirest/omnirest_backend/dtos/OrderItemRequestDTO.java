package com.omnirest.omnirest_backend.dtos;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import java.util.UUID;

public record OrderItemRequestDTO(
    @NotNull UUID productId,
    @NotNull @Min(1) Integer quantity,
    String specialInstructions,
    /** Ids de los adicionales elegidos. El precio lo pone el servidor. */
    java.util.List<UUID> adicionales
) {}
