package com.omnirest.omnirest_backend.dtos;

import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;

public record UpdateStockRequestDTO(
    @NotNull BigDecimal stock
) {}
