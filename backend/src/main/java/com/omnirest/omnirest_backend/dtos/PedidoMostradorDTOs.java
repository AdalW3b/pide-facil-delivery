package com.omnirest.omnirest_backend.dtos;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

/** Pedidos de mostrador: los del kiosko y los de "paso a recoger". */
public final class PedidoMostradorDTOs {

    private PedidoMostradorDTOs() {
    }

    public record Crear(
            @NotEmpty(message = "Agrega al menos un platillo.") List<@Valid PedidoDomicilioItemDTO> items,
            @NotBlank(message = "Escribe tu nombre para llamarte.") @Size(max = 60) String nombre,
            /** Obligatorio para pasar a recoger; en el kiosko es opcional (solo para avisarle). */
            @Size(max = 20) String telefono,
            /** AQUI o LLEVAR. Pasar a recoger siempre es LLEVAR. */
            @Pattern(regexp = "AQUI|LLEVAR", message = "Elige si es para comer aquí o para llevar.") String consumo,
            @Size(max = 300) String notas) {
    }

    public record Creado(
            UUID orderId,
            String turno,
            String tokenSeguimiento,
            String consumo,
            BigDecimal total,
            /** Del kiosko: hay que pasar a caja antes de que se prepare. */
            boolean pagarEnCaja) {
    }
}
