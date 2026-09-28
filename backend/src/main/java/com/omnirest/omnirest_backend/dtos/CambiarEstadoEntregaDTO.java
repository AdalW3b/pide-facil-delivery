package com.omnirest.omnirest_backend.dtos;

import com.omnirest.omnirest_backend.domain.enums.DeliveryStatus;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/** Movimiento del pedido en el tablero. El motivo solo se usa al cancelar. */
public record CambiarEstadoEntregaDTO(
        @NotNull DeliveryStatus estado,
        @Size(max = 200) String motivo) {
}
