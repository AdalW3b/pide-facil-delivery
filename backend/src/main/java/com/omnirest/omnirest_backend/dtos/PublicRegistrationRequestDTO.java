package com.omnirest.omnirest_backend.dtos;

import jakarta.validation.constraints.NotBlank;

public record PublicRegistrationRequestDTO(
    @NotBlank String restaurantName,
    @NotBlank String branchName,
    String branchAddress,
    String whatsappNumber,
    @NotBlank String name,
    @NotBlank String username,
    @NotBlank String password,
    String phoneNumber,
    String stripeSessionId,
    String plan,
    String cycle
) {}
