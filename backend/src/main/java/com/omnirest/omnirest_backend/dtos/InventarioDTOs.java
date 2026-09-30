package com.omnirest.omnirest_backend.dtos;

import com.omnirest.omnirest_backend.domain.enums.ControlInventario;
import com.omnirest.omnirest_backend.domain.enums.TipoMovimiento;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

/** Tipos del inventario: modo de control y movimientos. */
public final class InventarioDTOs {

    private InventarioDTOs() {
    }

    public record Config(@NotNull(message = "Elige cómo se controla el inventario.") ControlInventario modo) {
    }

    /**
     * Un movimiento capturado a mano. De un ingrediente o de un producto
     * terminado (refrescos), nunca de los dos.
     *
     * ENTRADA y MERMA: cantidad es cuanto entro o salio. CONTEO: lo que hay de
     * verdad en el refri; el sistema registra la diferencia.
     */
    public record NuevoMovimiento(
            UUID ingredientId,
            UUID productId,
            @NotNull(message = "Elige qué movimiento es.") TipoMovimiento tipo,
            @NotNull(message = "Escribe la cantidad.")
            @DecimalMin(value = "0.0", message = "La cantidad no puede ser negativa.") BigDecimal cantidad,
            /** En que unidad se escribio (g, kg...). Null = la del ingrediente. */
            @Size(max = 20) String unidad,
            /** Solo en entradas: cuanto se pago por toda la cantidad. */
            @DecimalMin(value = "0.0", message = "El costo no puede ser negativo.") BigDecimal costoTotal,
            @Size(max = 120) String proveedor,
            @Size(max = 300) String nota) {
    }

    public record Movimiento(
            UUID id,
            TipoMovimiento tipo,
            BigDecimal cantidad,
            BigDecimal saldo,
            BigDecimal costoUnitario,
            String proveedor,
            String nota,
            String usuario,
            UUID orderId,
            LocalDateTime creadoEn) {
    }

    /** Lo que responde al registrar: el saldo con que quedo. */
    public record Resultado(BigDecimal saldo, String mensaje) {
    }
}
