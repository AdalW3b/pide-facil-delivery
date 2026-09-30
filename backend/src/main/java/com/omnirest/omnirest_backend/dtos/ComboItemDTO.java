package com.omnirest.omnirest_backend.dtos;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * Un platillo dentro de un combo. Al guardar solo cuentan productId y cantidad;
 * lo demas se llena al leer, para mostrar el ahorro y si algo esta desactivado.
 */
public record ComboItemDTO(
    UUID productId,
    Integer cantidad,
    String nombre,
    BigDecimal precio,
    Boolean activo
) {}
