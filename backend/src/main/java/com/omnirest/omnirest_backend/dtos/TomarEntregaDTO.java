package com.omnirest.omnirest_backend.dtos;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** El repartidor se identifica con su WhatsApp; el nombre solo la primera vez. */
public record TomarEntregaDTO(
        /** Ya no identifica: quien toma la entrega es el de la sesion. Se ignora. */
        @Size(max = 20) String phoneNumber,
        @Size(max = 120) String nombre,
        @Size(max = 40) String vehiculo) {
}
