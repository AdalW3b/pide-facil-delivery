package com.omnirest.omnirest_backend.dtos;

public record BulkTableResponseDTO(
    String message,
    Integer createdCount,
    Integer skippedCount
) {}
