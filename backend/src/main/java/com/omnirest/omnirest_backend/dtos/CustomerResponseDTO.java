package com.omnirest.omnirest_backend.dtos;

import java.util.UUID;

public record CustomerResponseDTO(
    UUID id,
    String phoneNumber,
    String name,
    Integer totalVisits,
    boolean isNewCustomer
) {}
