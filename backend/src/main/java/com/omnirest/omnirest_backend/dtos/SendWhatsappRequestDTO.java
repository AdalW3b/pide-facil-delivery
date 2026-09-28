package com.omnirest.omnirest_backend.dtos;

import jakarta.validation.constraints.NotBlank;

public record SendWhatsappRequestDTO(
    @NotBlank String recipientNumber,
    @NotBlank String message
) {}
