package com.omnirest.omnirest_backend.dtos;

import jakarta.validation.constraints.NotBlank;
import java.util.UUID;

public record PaymentMethodDTO(
    UUID id,
    @NotBlank String name,
    Boolean active,
    String instructions
) {}
