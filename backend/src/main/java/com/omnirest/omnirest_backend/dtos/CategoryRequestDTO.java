package com.omnirest.omnirest_backend.dtos;

import jakarta.validation.constraints.NotBlank;

public record CategoryRequestDTO(
    @NotBlank String name,
    Boolean active
) {}
