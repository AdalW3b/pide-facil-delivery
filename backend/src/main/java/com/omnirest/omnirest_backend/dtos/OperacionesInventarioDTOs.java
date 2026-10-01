package com.omnirest.omnirest_backend.dtos;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/** Tipos de la pantalla de Inventario: existencias, compras, conteos, preparaciones, transferencias y reporte. */
public final class OperacionesInventarioDTOs {

    private OperacionesInventarioDTOs() {
    }

    /**
     * Un articulo del inventario, sea ingrediente o producto terminado
     * (refrescos): la pantalla los maneja igual.
     */
    public record Articulo(
            String tipo,
            UUID id,
            String nombre,
            String unidad,
            BigDecimal existencia,
            BigDecimal minimo,
            BigDecimal costo,
            String zona,
            boolean activo,
            int usos,
            boolean esPreparado) {
    }

    /** Minimo, zona y costo de un articulo (los demas datos se editan en el catalogo). */
    public record ActualizarArticulo(
            @DecimalMin(value = "0.0", message = "El mínimo no puede ser negativo.") BigDecimal minimo,
            @Size(max = 40) String zona,
            @DecimalMin(value = "0.0", message = "El costo no puede ser negativo.") BigDecimal costo) {
    }

    /** Un renglon de compra, conteo o transferencia. */
    public record Renglon(
            UUID ingredientId,
            UUID productId,
            @NotNull(message = "Falta la cantidad.")
            @DecimalMin(value = "0.0", message = "La cantidad no puede ser negativa.") BigDecimal cantidad,
            @Size(max = 20) String unidad,
            /** Solo en compras: cuanto se pago por ese renglon. */
            @DecimalMin(value = "0.0", message = "El costo no puede ser negativo.") BigDecimal costoTotal) {
    }

    public record NuevaCompra(
            @Size(max = 120) String proveedor,
            @Size(max = 300) String nota,
            @NotEmpty(message = "Agrega al menos un renglón.") @Valid List<Renglon> renglones) {
    }

    public record CompraHecha(
            UUID id,
            String proveedor,
            String nota,
            BigDecimal total,
            String usuario,
            LocalDateTime creadoEn,
            List<String> renglones) {
    }

    /** Conteo fisico: solo los renglones que se contaron; lo demas no se toca. */
    public record NuevoConteo(
            @Size(max = 300) String nota,
            @NotEmpty(message = "Cuenta al menos un artículo.") @Valid List<Renglon> renglones) {
    }

    public record NuevaTransferencia(
            @NotNull(message = "Elige a qué sucursal va.") UUID destinoId,
            @Size(max = 300) String nota,
            @NotEmpty(message = "Agrega al menos un renglón.") @Valid List<Renglon> renglones) {
    }

    public record Lote(int renglones, String mensaje) {
    }

    // ------------------------------------------------------------------ preparaciones

    public record Componente(
            @NotNull(message = "Elige el ingrediente.") UUID componenteId,
            String nombre,
            @NotNull(message = "Escribe la cantidad.")
            @DecimalMin(value = "0.0", inclusive = false, message = "La cantidad debe ser mayor a cero.") BigDecimal cantidad,
            @Size(max = 20) String unidad) {
    }

    public record Preparacion(
            UUID preparadoId,
            String nombre,
            String unidad,
            @NotNull(message = "Escribe cuánto rinde una tanda.")
            @DecimalMin(value = "0.0", inclusive = false, message = "Lo que rinde debe ser mayor a cero.") BigDecimal rinde,
            @NotEmpty(message = "Agrega al menos un ingrediente.") @Valid List<Componente> componentes,
            /** Costo por unidad del preparado, con los costos de hoy. Null si falta alguno. */
            BigDecimal costoPorUnidad) {
    }

    public record Producir(
            @NotNull(message = "Elige qué preparaste.") UUID preparadoId,
            @NotNull(message = "Escribe cuánto preparaste.")
            @DecimalMin(value = "0.0", inclusive = false, message = "La cantidad debe ser mayor a cero.") BigDecimal cantidad,
            @Size(max = 300) String nota) {
    }

    // ------------------------------------------------------------------ reporte

    public record RenglonReporte(
            String tipo,
            UUID id,
            String nombre,
            String unidad,
            BigDecimal existencia,
            BigDecimal minimo,
            BigDecimal entradas,
            BigDecimal consumo,
            BigDecimal merma,
            BigDecimal costoUnitario,
            BigDecimal costoConsumo,
            BigDecimal costoMerma,
            BigDecimal consumoDiario,
            /** Dias que alcanza lo que hay al ritmo de consumo del periodo. Null si no se consume. */
            BigDecimal diasQueAlcanza,
            /** Cuanto comprar para cubrir una semana y quedar arriba del minimo. */
            BigDecimal sugerido) {
    }

    public record Reporte(
            LocalDateTime desde,
            LocalDateTime hasta,
            BigDecimal costoConsumo,
            BigDecimal costoMerma,
            List<RenglonReporte> renglones) {
    }
}
