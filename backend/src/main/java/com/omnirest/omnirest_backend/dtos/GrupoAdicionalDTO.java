package com.omnirest.omnirest_backend.dtos;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;

import java.util.List;
import java.util.UUID;

/**
 * Un grupo de adicionales tal como lo edita el panel: sus opciones, en el orden
 * en que se muestran, y a que categorias y platillos aplica.
 */
public record GrupoAdicionalDTO(
        UUID id,
        @NotBlank(message = "El grupo necesita un nombre, por ejemplo \"Extras\" o \"Tortilla\".")
        @Size(max = 60, message = "El nombre del grupo admite hasta 60 caracteres.")
        String nombre,
        @Min(value = 0, message = "El mínimo no puede ser negativo.")
        Integer minimo,
        @Min(value = 1, message = "El máximo debe ser al menos 1.")
        Integer maximo,
        Integer orden,
        Boolean activo,
        @NotEmpty(message = "Agrega al menos una opción al grupo.")
        @Valid
        List<AdicionalDTO> opciones,
        List<UUID> categoryIds,
        List<UUID> productIds) {
}
