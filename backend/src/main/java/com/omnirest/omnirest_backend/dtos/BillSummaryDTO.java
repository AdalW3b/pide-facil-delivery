package com.omnirest.omnirest_backend.dtos;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

public record BillSummaryDTO(
    UUID orderId,
    Integer tableNumber,
    List<OrderItemResponseDTO> items,
    BigDecimal totalAmount,
    String formattedBillText,
    /** WhatsApp del cliente de la mesa; null si no se sabe. */
    String telefonoCliente,
    /** Cuando se le mando la cuenta por WhatsApp; null si no se ha mandado. */
    java.time.LocalDateTime cuentaEnviadaEn
) {}
