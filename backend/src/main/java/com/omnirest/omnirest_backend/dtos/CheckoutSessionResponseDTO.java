package com.omnirest.omnirest_backend.dtos;

public record CheckoutSessionResponseDTO(
    String checkoutUrl,
    String sessionId
) {}
