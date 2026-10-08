package com.omnirest.omnirest_backend.dtos;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/** Gastos que no son compras de mercancia: renta, luz, nomina… */
public final class GastosDTOs {

    private GastosDTOs() {
    }

    public record Gasto(
            UUID id,
            String categoria,
            String concepto,
            BigDecimal monto,
            LocalDate fecha,
            /** CAJA, TRANSFERENCIA o TARJETA. */
            String formaPago,
            String nota,
            UUID gastoFijoId,
            String usuario,
            LocalDateTime creadoEn,
            boolean anulado,
            String anuladoPor) {
    }

    public record NuevoGasto(
            @NotBlank(message = "Elige la categoría.") String categoria,
            @NotBlank(message = "Escribe qué se pagó.") @Size(max = 120) String concepto,
            @NotNull(message = "Escribe el monto.")
            @DecimalMin(value = "0.0", inclusive = false, message = "El monto debe ser mayor a cero.") BigDecimal monto,
            /** Cuando se pago; sin fecha, hoy. Nunca futura. */
            LocalDate fecha,
            @NotBlank(message = "Elige cómo se pagó.") String formaPago,
            @Size(max = 300) String nota,
            /** Si es el pago de un gasto fijo del mes. */
            UUID gastoFijoId) {
    }

    /** Un gasto fijo y como va en el mes que se esta viendo. */
    public record GastoFijo(
            UUID id,
            String categoria,
            String concepto,
            BigDecimal monto,
            int diaDelMes,
            boolean activo,
            /** Cuando toca pagarlo en ese mes. */
            LocalDate vence,
            /** El pago de ese mes, si ya se hizo. */
            Gasto pago) {
    }

    public record GuardarGastoFijo(
            @NotBlank(message = "Elige la categoría.") String categoria,
            @NotBlank(message = "Escribe el concepto.") @Size(max = 120) String concepto,
            @NotNull(message = "Escribe el monto.")
            @DecimalMin(value = "0.0", inclusive = false, message = "El monto debe ser mayor a cero.") BigDecimal monto,
            @NotNull(message = "Escribe qué día del mes se paga.")
            @Min(value = 1, message = "El día va del 1 al 31.") @Max(value = 31, message = "El día va del 1 al 31.") Integer diaDelMes) {
    }

    /** Lo de un mes: los gastos fijos (pagados o no) y todo lo que se gasto. */
    public record Mes(
            /** "2026-10". */
            String mes,
            List<GastoFijo> fijos,
            List<Gasto> gastos,
            /** Lo gastado en el mes (sin anulados). */
            BigDecimal total,
            /** Lo que falta de los gastos fijos activos. */
            BigDecimal pendiente) {
    }

    public record Resultado(String mensaje) {
    }
}
