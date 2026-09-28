package com.omnirest.omnirest_backend.dtos;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.util.List;
import java.util.UUID;

public record WebhookOrderRequestDTO(
    @NotNull UUID branchId,
    @NotBlank String phoneNumber,
    @NotNull Integer tableNumber,
    // Puede llegar vacia: el bot manda solo los platillos NUEVOS, y cuando el
    // cliente reconfirma sin agregar nada la lista viene sin elementos. Se
    // acepta y no se hace nada, en vez de tumbar la conversacion con un 400.
    List<WebhookOrderItemDTO> items
) {}
