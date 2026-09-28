package com.omnirest.omnirest_backend.dtos;

import com.omnirest.omnirest_backend.domain.enums.KitchenStatus;
import com.omnirest.omnirest_backend.domain.enums.TableStatus;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

public record TableResponseDTO(
    UUID id,
    UUID branchId,
    Integer tableNumber,
    TableStatus status,
    UUID activeOrderId,
    BigDecimal totalAmount,
    List<OrderItemResponseDTO> items,
    String qrToken,
    List<WaiterSummaryDTO> assignedWaiters,
    // Como va la cocina de la orden activa. Null si la mesa no tiene platillos vivos.
    KitchenStatus kitchenStatus,
    // Desde cuando esta abierta la cuenta. Null si la mesa esta libre.
    java.time.LocalDateTime abiertaDesde
) {}
