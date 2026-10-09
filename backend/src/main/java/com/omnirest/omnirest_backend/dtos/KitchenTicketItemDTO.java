package com.omnirest.omnirest_backend.dtos;

import com.omnirest.omnirest_backend.domain.enums.KitchenStatus;
import java.util.UUID;

public record KitchenTicketItemDTO(
    UUID itemId,
    String productName,
    Integer quantity,
    String specialInstructions,
    KitchenStatus kitchenStatus,
    /** "Tortilla: Harina", "Extras: Carne extra, Queso". Vacia si no lleva. */
    java.util.List<String> adicionales,
    /** Cuando se pidio: cocina separa las rondas y mide la espera desde aqui. Null si acaba de entrar. */
    java.time.LocalDateTime createdAt,
    /** El area que lo prepara (Cocina, Barra…). Cada pantalla de area filtra por esto. */
    java.util.UUID areaId
) {}
