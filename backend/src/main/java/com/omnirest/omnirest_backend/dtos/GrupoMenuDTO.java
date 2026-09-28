package com.omnirest.omnirest_backend.dtos;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

/** Un grupo de adicionales como lo ve el cliente en la ficha del platillo. */
public record GrupoMenuDTO(
        UUID id,
        String nombre,
        int minimo,
        int maximo,
        List<Opcion> opciones) {

    /** {@code disponible} false = agotado hoy: se muestra, pero no se puede elegir. */
    public record Opcion(UUID id, String nombre, BigDecimal precio, boolean disponible) {
    }
}
