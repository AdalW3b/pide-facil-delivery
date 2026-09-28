package com.omnirest.omnirest_backend.dtos;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Lo que un repartidor hizo en un periodo. Es la base para pagarle: cuantas
 * entregas cerro, cuanto recorrio y cuanto se le debe.
 */
public record ReporteRepartidorDTO(
        UUID driverId,
        String nombre,
        String telefono,
        String vehiculo,
        Boolean activo,
        Long entregas,
        BigDecimal kmTotales,
        /** Lo que el negocio le debe por esas entregas. */
        BigDecimal aPagar,
        /** Dinero que recibio de los clientes y tiene que entregar en caja. */
        BigDecimal cobrado,
        LocalDateTime ultimaEntrega) {
}
