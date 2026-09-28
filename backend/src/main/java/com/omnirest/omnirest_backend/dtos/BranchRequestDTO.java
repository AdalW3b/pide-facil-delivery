package com.omnirest.omnirest_backend.dtos;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record BranchRequestDTO(
    @NotBlank @Size(max = 100) String name,
    String address,
    @Pattern(regexp = "^\\+?[1-9]\\d{6,14}$", message = "Formato de número de WhatsApp inválido")
    String whatsappNumber,
    String webhookSecret
) {}
