package com.omnirest.omnirest_backend.dtos;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/** Compras, proveedores y presentaciones de compra. */
public final class ComprasDTOs {

    private ComprasDTOs() {
    }

    // ------------------------------------------------------------------ proveedores

    /** Un articulo del inventario: ingrediente o producto terminado. */
    public record ArticuloRef(
            @NotBlank String tipo,
            @NotNull UUID id,
            String nombre) {
    }

    public record Proveedor(
            UUID id,
            String nombre,
            String contacto,
            String telefono,
            int diasCredito,
            /** "LUN", "JUE"… */
            List<String> diasVisita,
            String notas,
            boolean activo,
            List<ArticuloRef> surte,
            /** Lo que se le debe de compras a credito sin pagar. */
            BigDecimal debemos) {
    }

    public record GuardarProveedor(
            @NotBlank(message = "Escribe el nombre del proveedor.") @Size(max = 120) String nombre,
            @Size(max = 120) String contacto,
            @Size(max = 30) String telefono,
            @Min(value = 0, message = "Los días de crédito no pueden ser negativos.") Integer diasCredito,
            List<String> diasVisita,
            @Size(max = 300) String notas,
            @Valid List<ArticuloRef> surte) {
    }

    // ------------------------------------------------------------------ presentaciones

    public record Presentacion(UUID id, String tipo, UUID articuloId, String nombre, BigDecimal factor) {
    }

    public record NuevaPresentacion(
            @NotBlank String tipo,
            @NotNull UUID articuloId,
            @NotBlank(message = "Escribe cómo se llama, por ejemplo \"caja de 24\".") @Size(max = 60) String nombre,
            @NotNull(message = "Escribe cuánto trae.")
            @DecimalMin(value = "0.0", inclusive = false, message = "Lo que trae debe ser mayor a cero.") BigDecimal factor) {
    }

    // ------------------------------------------------------------------ precios

    /** Lo ultimo que se pago por un articulo en la sucursal, por unidad y sin IVA. */
    public record UltimoPrecio(String tipo, UUID articuloId, BigDecimal costoUnitario, LocalDateTime fecha, String proveedor) {
    }

    // ------------------------------------------------------------------ compras

    /** Un renglon de la nota, como viene: "2 cajas de 24 por $624". */
    public record RenglonCompra(
            UUID ingredientId,
            UUID productId,
            @NotNull(message = "Falta la cantidad.")
            @DecimalMin(value = "0.0", inclusive = false, message = "La cantidad debe ser mayor a cero.") BigDecimal cantidad,
            /** Unidad suelta (kg, g, pieza) si no se eligio presentacion. */
            @Size(max = 20) String unidad,
            /** "Caja de 24": la cantidad se multiplica por lo que trae. */
            UUID presentacionId,
            /** Lo que dice la nota en este renglon (con o sin IVA, segun la compra). */
            @DecimalMin(value = "0.0", message = "El importe no puede ser negativo.") BigDecimal importe) {
    }

    public record NuevaCompra(
            UUID proveedorId,
            /** Solo si no se eligio un proveedor guardado. */
            @Size(max = 120) String proveedor,
            @Size(max = 40) String folio,
            /** La fecha de la nota; sin fecha, hoy. Nunca futura. */
            LocalDate fecha,
            /** CAJA, TRANSFERENCIA o CREDITO. */
            @NotBlank(message = "Elige cómo se pagó.") String formaPago,
            /** INCLUIDO, APARTE o SIN. */
            String iva,
            @Size(max = 300) String nota,
            @NotEmpty(message = "Agrega al menos un artículo.") @Valid List<RenglonCompra> renglones) {
    }

    public record Compra(
            UUID id,
            String proveedor,
            UUID proveedorId,
            String folio,
            LocalDate fecha,
            String formaPago,
            String iva,
            BigDecimal subtotal,
            BigDecimal ivaMonto,
            BigDecimal total,
            String nota,
            String usuario,
            LocalDateTime creadoEn,
            List<String> renglones,
            LocalDate vence,
            boolean pagada,
            boolean anulada,
            String anuladaPor,
            String motivoAnulacion) {
    }

    public record Anular(@Size(max = 300) String motivo) {
    }

    public record Resultado(String mensaje) {
    }
}
