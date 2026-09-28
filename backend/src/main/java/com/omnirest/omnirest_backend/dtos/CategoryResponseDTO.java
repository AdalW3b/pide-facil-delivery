package com.omnirest.omnirest_backend.dtos;

import java.util.UUID;

public record CategoryResponseDTO(
    UUID id,
    UUID restaurantId,
    String name,
    Boolean active
) {}
