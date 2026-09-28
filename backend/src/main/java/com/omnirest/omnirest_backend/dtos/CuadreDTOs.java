package com.omnirest.omnirest_backend.dtos;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

/** Tipos del cuadre de efectivo de los repartidores. */
public final class CuadreDTOs {

    private CuadreDTOs() {
    }

    /** Lo que un repartidor tiene por liquidar: entregas cerradas que aun no pasan por caja. */
    public record Pendiente(
            UUID driverId,
            String nombre,
            String telefono,
            long entregas,
            BigDecimal cobrado,
            BigDecimal pagoRepartidor,
            LocalDateTime primeraEntrega,
            LocalDateTime ultimaEntrega) {
    }

    public record CerrarCorte(
            @NotNull(message = "Falta el repartidor.") UUID driverId,
            @NotNull(message = "Escribe cuánto entregó.")
            @DecimalMin(value = "0.0", message = "Lo entregado no puede ser negativo.") BigDecimal recibido,
            /** true (por omision): su pago sale del mismo efectivo. */
            Boolean pagoDescontado,
            @Size(max = 300) String notas) {
    }

    public record Corte(
            UUID id,
            String repartidor,
            LocalDateTime creadoEn,
            int entregas,
            BigDecimal cobrado,
            BigDecimal pagoRepartidor,
            boolean pagoDescontado,
            BigDecimal esperado,
            BigDecimal recibido,
            BigDecimal diferencia,
            String notas) {
    }
}
