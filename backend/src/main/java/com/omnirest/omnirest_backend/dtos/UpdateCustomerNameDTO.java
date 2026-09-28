package com.omnirest.omnirest_backend.dtos;

import jakarta.validation.constraints.NotBlank;

public record UpdateCustomerNameDTO(
    @NotBlank String name
) {}
