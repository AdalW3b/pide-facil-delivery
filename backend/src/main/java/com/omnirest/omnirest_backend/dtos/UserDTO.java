package com.omnirest.omnirest_backend.dtos;

import java.util.List;
import java.util.UUID;

public record UserDTO(
        UUID id,
        String username,
        String role,
        String defaultRoute,
        UUID restaurantId,
        UUID branchId,
        List<String> permissions,
        Boolean isDemo) {
}
