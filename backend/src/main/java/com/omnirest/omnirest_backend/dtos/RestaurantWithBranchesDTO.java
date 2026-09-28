package com.omnirest.omnirest_backend.dtos;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public record RestaurantWithBranchesDTO(
    UUID id,
    String name,
    Boolean active,
    LocalDateTime createdAt,
    List<BranchResponseDTO> branches
) {}
