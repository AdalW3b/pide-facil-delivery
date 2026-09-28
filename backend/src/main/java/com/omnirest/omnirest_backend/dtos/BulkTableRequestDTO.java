package com.omnirest.omnirest_backend.dtos;

import jakarta.validation.constraints.NotEmpty;
import java.util.List;

public record BulkTableRequestDTO(
    @NotEmpty List<Integer> tableNumbers
) {}
