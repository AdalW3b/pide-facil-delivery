package com.omnirest.omnirest_backend.dtos;

import java.time.LocalDateTime;
import java.util.UUID;

public record BranchResponseDTO(
    UUID id,
    UUID restaurantId,
    String restaurantName,
    String name,
    String address,
    String whatsappNumber,
    String n8nWebhookUrl,
    Boolean active,
    LocalDateTime createdAt
) {}
