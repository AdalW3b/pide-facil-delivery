package com.omnirest.omnirest_backend.dtos;

import com.omnirest.omnirest_backend.domain.enums.OrderType;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/**
 * Un ticket del tablero de cocina. {@code tableNumber} viene en null cuando el
 * pedido no es de salon; para esos casos {@code etiqueta} dice a donde va.
 */
public record KitchenTicketDTO(
    UUID orderId,
    Integer tableNumber,
    LocalDateTime createdAt,
    List<KitchenTicketItemDTO> items,
    OrderType orderType,
    String etiqueta
) {}
