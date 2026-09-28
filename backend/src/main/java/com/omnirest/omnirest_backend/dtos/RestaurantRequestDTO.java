package com.omnirest.omnirest_backend.dtos;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record RestaurantRequestDTO(
    @NotBlank @Size(max = 100) String name
) {}
