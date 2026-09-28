package com.omnirest.omnirest_backend.dtos;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import java.util.List;

public record AddItemsRequestDTO(
    @NotEmpty List<@Valid OrderItemRequestDTO> items
) {}
