package com.omnirest.omnirest_backend.dtos;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.util.List;
import java.util.UUID;

public record RoleRequestDTO(
    @NotBlank String name,
    String description,
    String defaultRoute,
    UUID restaurantId,
    @NotNull List<UUID> permissionIds
) {}
