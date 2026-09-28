package com.omnirest.omnirest_backend.dtos;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.UUID;

public record CreateUserRequestDTO(
    @NotBlank @Size(min = 3, max = 50) String username,
    @NotBlank @Size(min = 6) String password,
    @NotNull UUID roleId,
    @NotNull UUID restaurantId,
    UUID branchId
) {}
