package com.omnirest.omnirest_backend.dtos;

import java.math.BigDecimal;
import java.util.UUID;

public record OrderItemResponseDTO(
    UUID id,
    UUID productId,
    String productName,
    Integer quantity,
    BigDecimal unitPrice,
    String specialInstructions,
    /** "Tortilla: Harina", "Extras: Carne extra, Queso". Vacia si no lleva. */
    java.util.List<String> adicionales
) {}
