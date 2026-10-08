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
            UUID zonaId,
            String zona,
            boolean activo,
            int usos,
            boolean esPreparado) {
    }

    /** Minimo, zona y costo de un articulo (los demas datos se editan en el catalogo). */
    public record ActualizarArticulo(
            @DecimalMin(value = "0.0", message = "El mínimo no puede ser negativo.") BigDecimal minimo,
            /** Una de las zonas dadas de alta; null = sin zona. */
            UUID zonaId,
            @DecimalMin(value = "0.0", message = "El costo no puede ser negativo.") BigDecimal costo) {
    }

    /** Una zona dada de alta, con cuantos articulos tiene. */
    public record Zona(UUID id, String nombre, Integer orden, long articulos) {
    }

    public record NuevaZona(
            @jakarta.validation.constraints.NotBlank(message = "Escribe el nombre de la zona.")
            @Size(max = 40, message = "Máximo 40 caracteres.") String nombre,
            Integer orden) {
    }

    /** Un renglon de conteo o transferencia. */
    public record Renglon(
            UUID ingredientId,
            UUID productId,
            @NotNull(message = "Falta la cantidad.")
            @DecimalMin(value = "0.0", message = "La cantidad no puede ser negativa.") BigDecimal cantidad,
            @Size(max = 20) String unidad) {
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
            BigDecimal costoPorUnidad,
            /** Si al vender no alcanza lo registrado, preparar lo que falta con sus ingredientes. */
            Boolean prepararAlVender) {
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
            /** Cuanto comprar (o preparar, si es preparacion) para cubrir una semana y quedar arriba del minimo. */
            BigDecimal sugerido,
            /** Se hace en cocina: lo sugerido se prepara, no se compra. */
            boolean esPreparado,
            /** Lo que movieron los conteos y ajustes: negativo = falto contra lo que decia el sistema. */
            BigDecimal diferenciaConteo,
            BigDecimal costoDiferencia) {
    }

    /** Lo de una sucursal en el resumen del dueño. */
    public record CosteoSucursal(
            UUID branchId,
            String sucursal,
            BigDecimal costoConsumo,
            BigDecimal costoMerma,
            BigDecimal costoDiferencias,
            /** Articulos en negativo o bajo su minimo. */
            int porReponer) {
    }

    /** Todas las sucursales del restaurante, para el dueño. */
    public record CosteoRestaurante(
            LocalDateTime desde,
            LocalDateTime hasta,
            BigDecimal costoConsumo,
            BigDecimal costoMerma,
            BigDecimal costoDiferencias,
            List<CosteoSucursal> sucursales) {
    }

    public record Reporte(
            LocalDateTime desde,
            LocalDateTime hasta,
            BigDecimal costoConsumo,
            BigDecimal costoMerma,
            /** Lo que falto (negativo) o sobro en los conteos del periodo, a costo. */
            BigDecimal costoDiferencias,
            List<RenglonReporte> renglones) {
    }
}
