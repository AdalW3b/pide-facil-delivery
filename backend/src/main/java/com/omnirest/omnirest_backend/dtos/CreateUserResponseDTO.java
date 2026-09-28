package com.omnirest.omnirest_backend.dtos;

import java.time.LocalDateTime;
import java.util.UUID;

public record CreateUserResponseDTO(
    UUID id,
    String username,
    String roleName,
    UUID restaurantId,
    UUID branchId,
    Boolean active,
    LocalDateTime createdAt
) {}
