package com.omnirest.omnirest_backend.dtos;

import java.util.List;
import java.util.UUID;

public record RoleDTO(
    UUID id,
    String name,
    String description,
    Boolean isCustom,
    String defaultRoute,
    UUID restaurantId,
    List<PermissionDTO> permissions
) {}
