package com.omnirest.omnirest_backend.dtos;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Tipos de la caja: abrirla, cobrar, mover efectivo y el arqueo. */
public final class CajaDTOs {

    private CajaDTOs() {
    }

    // ------------------------------------------------------------------
    // Peticiones
    // ------------------------------------------------------------------

    public record AbrirCaja(
            @NotNull(message = "Escribe con cuánto efectivo abres la caja.")
            @DecimalMin(value = "0.0", message = "El fondo no puede ser negativo.") BigDecimal fondoInicial) {
    }

    public record NuevoMovimiento(
            @NotNull(message = "Elige si entra o sale efectivo.") String tipo,
            @NotNull(message = "Escribe el monto.")
            @DecimalMin(value = "0.01", message = "El monto tiene que ser mayor a cero.") BigDecimal monto,
            @NotBlank(message = "Escribe el concepto.") @Size(max = 200) String concepto) {
    }

    /**
     * Lo contado al cerrar: por billetes y monedas ({@code conteo}) o el total
     * de una vez ({@code efectivoContado}). Si vienen los dos, manda el conteo.
     */
    public record CerrarCaja(
            Map<String, Integer> conteo,
            @DecimalMin(value = "0.0", message = "Lo contado no puede ser negativo.") BigDecimal efectivoContado,
            @Size(max = 500) String notas) {
    }

    public record PagoPeticion(
            @NotNull(message = "Elige el método de pago.") UUID paymentMethodId,
            @NotNull(message = "Escribe el monto.")
            @DecimalMin(value = "0.01", message = "El monto tiene que ser mayor a cero.") BigDecimal monto,
            @DecimalMin(value = "0.0", message = "La propina no puede ser negativa.") BigDecimal propina,
            /** Solo efectivo: con cuanto pago el cliente, para calcular el cambio. */
            @DecimalMin(value = "0.0") BigDecimal recibido) {
    }

    /** Los pagos de la cuenta. Vacio solo si la cuenta esta en $0; eso lo decide el servicio. */
    public record Cobrar(List<@Valid PagoPeticion> pagos) {
    }

    // ------------------------------------------------------------------
    // Respuestas
    // ------------------------------------------------------------------

    public record PagoDTO(UUID id, String metodo, boolean esEfectivo, BigDecimal monto, BigDecimal propina,
                          BigDecimal recibido, BigDecimal cambio, String cobradoPor, LocalDateTime creadoEn) {
    }

    public record CobroResultado(UUID orderId, BigDecimal total, BigDecimal propinas,
                                 /** Cambio total a entregar (solo efectivo). */ BigDecimal cambio,
                                 List<PagoDTO> pagos) {
    }

    public record MovimientoDTO(UUID id, String tipo, BigDecimal monto, String concepto, String por,
                                LocalDateTime creadoEn) {
    }

    /**
     * La caja abierta, tal como la ve quien la opera. No lleva ventas ni el
     * efectivo esperado: el cierre se cuenta a ciegas.
     */
    public record EstadoCaja(UUID turnoId, String abiertoPor, LocalDateTime abiertoEn, BigDecimal fondoInicial,
                             long cuentasCobradas, long cortesRecibidos, List<MovimientoDTO> movimientos) {
    }

    public record VentaPorMetodo(String metodo, boolean esEfectivo, long cobros, BigDecimal monto,
                                 BigDecimal propinas) {
    }

    public record CorteEnCaja(UUID corteId, String repartidor, int entregas, BigDecimal recibido,
                              LocalDateTime creadoEn) {
    }

    /** El arqueo de un turno cerrado. */
    public record Arqueo(
            UUID turnoId,
            String abiertoPor,
            LocalDateTime abiertoEn,
            String cerradoPor,
            LocalDateTime cerradoEn,
            BigDecimal fondoInicial,
            long cuentasCobradas,
            List<VentaPorMetodo> ventasPorMetodo,
            BigDecimal totalVentas,
            BigDecimal totalPropinas,
            List<MovimientoDTO> movimientos,
            BigDecimal entradas,
            BigDecimal salidas,
            List<CorteEnCaja> cortes,
            BigDecimal totalCortes,
            BigDecimal efectivoEsperado,
            BigDecimal efectivoContado,
            /** Contado menos esperado: positivo sobra, negativo falta. */
            BigDecimal diferencia,
            Map<String, Integer> conteo,
            String notas) {
    }

    /** Un renglon del historial de cierres. */
    public record TurnoResumen(UUID turnoId, String abiertoPor, LocalDateTime abiertoEn, String cerradoPor,
                               LocalDateTime cerradoEn, BigDecimal fondoInicial, BigDecimal efectivoEsperado,
                               BigDecimal efectivoContado, BigDecimal diferencia) {
    }
}
