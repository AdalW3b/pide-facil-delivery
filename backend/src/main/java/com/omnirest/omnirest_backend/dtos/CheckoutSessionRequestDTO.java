package com.omnirest.omnirest_backend.dtos;

import java.util.UUID;

public record CheckoutSessionRequestDTO(
    String plan,
    String planName,
    String cycle,
    Long amount,
    String currency,
    UUID restaurantId,
    String successUrl,
    String cancelUrl
) {}
