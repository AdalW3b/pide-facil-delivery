package com.omnirest.omnirest_backend.dtos;

import com.omnirest.omnirest_backend.domain.enums.TableStatus;
import jakarta.validation.constraints.NotNull;
import java.util.UUID;

public record TableRequestDTO(
    @NotNull Integer tableNumber,
    @NotNull TableStatus status,
    UUID branchId
) {}
