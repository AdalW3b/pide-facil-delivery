package com.omnirest.omnirest_backend.dtos;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/**
 * Lo que el encargado necesita ver al teclear el telefono de quien llama:
 * su nombre y sus direcciones, para no volver a dictarlas.
 */
public record ClienteTelefonoDTO(
        boolean encontrado,
        String telefono,
        String nombre,
        Integer visitas,
        LocalDateTime ultimaVisita,
        List<Direccion> direcciones) {

    public record Direccion(UUID id, String alias, String direccion, String referencias,
                            BigDecimal latitud, BigDecimal longitud) {
    }
}
