package com.omnirest.omnirest_backend.dtos;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * Una opcion de un grupo, para el panel. Al guardar, {@code id} null crea una
 * opcion nueva; con id actualiza la existente.
 */
public record AdicionalDTO(
        UUID id,
        @NotBlank(message = "Cada opción necesita un nombre.")
        @Size(max = 60, message = "El nombre de una opción admite hasta 60 caracteres.")
        String nombre,
        @DecimalMin(value = "0.0", message = "El precio de una opción no puede ser negativo.")
        BigDecimal precio,
        Boolean activo,
        /** Ingrediente que descuenta, opcional. */
        UUID ingredientId,
        /** Cuanto descuenta, en la unidad del ingrediente. */
        @DecimalMin(value = "0.001", message = "La cantidad del ingrediente debe ser mayor que cero.")
        BigDecimal cantidadIngrediente) {
}
