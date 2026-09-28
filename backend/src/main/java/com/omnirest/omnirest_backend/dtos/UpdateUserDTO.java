package com.omnirest.omnirest_backend.dtos;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import java.util.List;
import java.util.UUID;

public record UpdateUserDTO(
    @NotBlank String name,
    @NotBlank String username,
    String password, // Optional
    @NotNull UUID roleId,
    UUID branchId,
    List<UUID> assignedTableIds,
    @Pattern(regexp = "^\\+?[1-9]\\d{6,14}$", message = "Número de teléfono inválido") String phoneNumber
) {}
