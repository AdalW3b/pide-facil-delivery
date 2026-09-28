package com.omnirest.omnirest_backend.dtos;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

public record CreateTableRequestDTO(
    @NotNull @Positive Integer tableNumber,
    Integer capacity
) {}
