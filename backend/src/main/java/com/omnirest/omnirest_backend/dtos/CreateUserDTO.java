package com.omnirest.omnirest_backend.dtos;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.UUID;

public record CreateUserDTO(
    @NotBlank String name,
    @NotBlank String username,
    @NotBlank @Size(min = 6) String password,
    @NotNull UUID roleId,
    UUID branchId,
    List<UUID> assignedTableIds,
    @Pattern(regexp = "^\\+?[1-9]\\d{6,14}$", message = "Número de teléfono inválido") String phoneNumber,
    /** Su area de cocina (Barra, Cocina…). Null = puede elegir. */
    UUID areaId
) {}
