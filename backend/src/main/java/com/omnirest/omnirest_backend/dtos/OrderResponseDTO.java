package com.omnirest.omnirest_backend.dtos;

import com.omnirest.omnirest_backend.domain.enums.OrderStatus;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

public record OrderResponseDTO(
        UUID id,
        UUID branchId,
        String branchName,
        UUID tableId,
        Integer tableNumber,
        OrderStatus status,
        BigDecimal totalAmount,
        LocalDateTime createdAt,
        LocalDateTime closedAt,
        String waiterName) {
}
