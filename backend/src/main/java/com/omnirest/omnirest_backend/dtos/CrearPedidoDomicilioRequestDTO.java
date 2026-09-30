package com.omnirest.omnirest_backend.dtos;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.util.List;

/**
 * Pedido que llega desde el menu web. A diferencia del bot de WhatsApp, aqui el
 * cliente eligio de una lista y manda ids de producto, no nombres sueltos.
 */
public record CrearPedidoDomicilioRequestDTO(
        @NotBlank String phoneNumber,
        @Size(max = 120) String nombre,

        @NotBlank @Size(max = 300) String direccion,
        @Size(max = 300) String referencias,
        @NotNull @DecimalMin("-90.0") @DecimalMax("90.0") BigDecimal latitud,
        @NotNull @DecimalMin("-180.0") @DecimalMax("180.0") BigDecimal longitud,
        @Size(max = 300) String notas,

        /** Si viene true, la direccion queda guardada para el proximo pedido. */
        Boolean guardarDireccion,
        @Size(max = 60) String aliasDireccion,

        @NotEmpty @Valid List<PedidoDomicilioItemDTO> items,

        /** Con cuanto paga, para que el repartidor lleve cambio. */
        @DecimalMin(value = "0.0", message = "El monto con el que pagas no puede ser negativo.")
        @DecimalMax(value = "100000.0", message = "Revisa el monto con el que pagas.") BigDecimal pagaCon,
        @DecimalMin(value = "0.0", message = "La propina no puede ser negativa.")
        @DecimalMax(value = "10000.0", message = "Revisa la propina.") BigDecimal propina) {
}
