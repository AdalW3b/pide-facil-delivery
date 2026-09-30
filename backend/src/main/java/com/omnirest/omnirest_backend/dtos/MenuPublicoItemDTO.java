package com.omnirest.omnirest_backend.dtos;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

/** Un platillo tal como lo ve el cliente en el menu web. */
public record MenuPublicoItemDTO(
        UUID id,
        String nombre,
        BigDecimal precio,
        String descripcion,
        /** Los adicionales que se pueden elegir en su ficha; vacio si no tiene. */
        List<GrupoMenuDTO> grupos,
        /** Ruta de la foto cuadrada para la lista; null si no tiene foto. */
        String miniatura,
        /** Ruta de la foto grande para la ficha; null si no tiene foto. */
        String foto,
        /** Si es combo, lo que trae: ["4 × Taco al pastor", "2 × Refresco"]. Vacio si no. */
        List<String> incluye) {
}
