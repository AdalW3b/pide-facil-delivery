package com.omnirest.omnirest_backend.dtos;

import jakarta.validation.constraints.NotBlank;

public record CustomerIdentifyRequestDTO(
    @NotBlank String phoneNumber,
    String name,
    String profileName
) {}
