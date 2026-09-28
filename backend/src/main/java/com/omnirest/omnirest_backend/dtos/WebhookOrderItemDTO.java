package com.omnirest.omnirest_backend.dtos;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

public record WebhookOrderItemDTO(
    @NotBlank String product_name,
    @NotNull @Positive Integer quantity,
    String special_instructions,
    /**
     * Nombres de los adicionales, tal como aparecen en el menu del bot:
     * ["Harina", "Carne extra"]. Por nombre porque el bot no maneja ids.
     */
    java.util.List<String> adicionales
) {}
