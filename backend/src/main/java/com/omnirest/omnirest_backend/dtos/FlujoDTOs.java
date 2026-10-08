package com.omnirest.omnirest_backend.dtos;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/** Ingresos y egresos: el dinero que entró y el que salió en un periodo. */
public final class FlujoDTOs {

    private FlujoDTOs() {
    }

    /** Un renglon con nombre y monto: "Tarjeta $61,480". */
    public record Concepto(String nombre, BigDecimal monto) {
    }

    public record Ingresos(
            /** Ventas cobradas (comida y envio), sin propinas. */
            BigDecimal total,
            long cuentas,
            List<Concepto> porMetodo) {
    }

    /** Las propinas son del personal: no cuentan como ingreso, pero se llevan para repartirlas. */
    public record Propinas(
            BigDecimal total,
            /** Ya estan en el cajon. */
            BigDecimal enEfectivo,
            /** Con tarjeta o transferencia: hay que sacarlas de la caja para entregarlas. */
            BigDecimal otrosMetodos,
            /** Lo que ya salio de la caja como propina repartida. */
            BigDecimal repartidas,
            /** Quien atendio las cuentas que dejaron propina. */
            List<Concepto> porMesero) {
    }

    public record Salida(LocalDateTime fecha, String concepto, BigDecimal monto, String por, String sucursal) {
    }

    public record Egresos(
            BigDecimal total,
            /** Compras pagadas con efectivo de la caja, por la fecha de la nota. */
            BigDecimal comprasCaja,
            /** Compras pagadas por transferencia, por la fecha de la nota. */
            BigDecimal comprasTransferencia,
            /** Compras de antes de registrar la forma de pago. */
            BigDecimal comprasSinFormaPago,
            /** Lo comprado a credito, el dia que se pago. */
            BigDecimal pagosCredito,
            /** Renta, luz, nomina… registrados en Gastos, por la fecha en que se pagaron. */
            BigDecimal gastos,
            List<Concepto> gastosPorCategoria,
            /** Retiros de la caja que no son compras, gastos ni propinas. */
            BigDecimal otrasSalidas,
            List<Salida> detalleOtrasSalidas) {
    }

    public record Dia(LocalDate fecha, BigDecimal ingresos, BigDecimal egresos) {
    }

    public record PorProveedor(String proveedor, long notas, BigDecimal comprado, BigDecimal pagado, BigDecimal debe) {
    }

    public record Flujo(
            Ingresos ingresos,
            Egresos egresos,
            /** Ingresos menos egresos. */
            BigDecimal resultado,
            /** Comprado a credito en el periodo que sigue sin pagarse: aun no es egreso. */
            BigDecimal compradoSinPagar,
            Propinas propinas,
            List<Dia> porDia,
            List<PorProveedor> porProveedor) {
    }
}
