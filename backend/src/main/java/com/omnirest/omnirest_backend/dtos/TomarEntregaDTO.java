package com.omnirest.omnirest_backend.dtos;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** El repartidor se identifica con su WhatsApp; el nombre solo la primera vez. */
public record TomarEntregaDTO(
        @NotBlank @Size(max = 20) String phoneNumber,
        @Size(max = 120) String nombre,
        @Size(max = 40) String vehiculo) {
}
