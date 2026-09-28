package com.omnirest.omnirest_backend.dtos;

import com.omnirest.omnirest_backend.domain.enums.OrderType;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;

import java.math.BigDecimal;
import java.util.List;

/**
 * Pedido que toma el encargado por telefono. A diferencia del menu web, llega
 * ya confirmado: quien lo captura acaba de hablar con el cliente.
 */
public record PedidoTelefonicoDTO(
        @NotBlank(message = "Falta el teléfono del cliente.") String phoneNumber,
        @Size(max = 120) String nombre,
        /** DOMICILIO o PARA_LLEVAR. */
        @NotNull(message = "Indica si es a domicilio o para llevar.") OrderType tipo,
        @Size(max = 300) String direccion,
        @Size(max = 300) String referencias,
        @DecimalMin("-90.0") @DecimalMax("90.0") BigDecimal latitud,
        @DecimalMin("-180.0") @DecimalMax("180.0") BigDecimal longitud,
        @Size(max = 300) String notas,
        Boolean guardarDireccion,
        @Size(max = 60) String aliasDireccion,
        @NotEmpty(message = "Agrega al menos un platillo.") @Valid List<PedidoDomicilioItemDTO> items,
        BigDecimal pagaCon) {
}
