package com.omnirest.omnirest_backend.services;

import com.omnirest.omnirest_backend.dtos.FlujoDTOs;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.sql.Date;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.*;

/**
 * Ingresos y egresos: el dinero que entro y el que salio.
 *
 * Reglas:
 *  - Ingreso es lo cobrado (comida y envio) el dia en que se cobro. Las
 *    propinas son del personal: van aparte, para repartirlas.
 *  - Una compra de contado (caja o transferencia) es egreso en la fecha de la
 *    nota; una a credito, el dia en que se pago. Las anuladas no cuentan.
 *  - Las salidas de caja que pagaron compras ya estan en las compras, y las
 *    propinas repartidas no son del restaurante: no se cuentan como "otras
 *    salidas".
 *
 * No es la utilidad (ventas menos costo de recetas): es el dinero.
 */
@Service
@RequiredArgsConstructor
public class FlujoService {

    /** Con rangos mas largos (o el historico) la grafica solo trae los dias con movimiento. */
    private static final int DIAS_A_RELLENAR = 92;

    private final JdbcTemplate jdbcTemplate;

    private NamedParameterJdbcTemplate jdbc() {
        return new NamedParameterJdbcTemplate(jdbcTemplate);
    }

    /** [desde, hasta) en dias; desde null = sin limite. */
    private record Periodo(LocalDate desde, LocalDate hasta) {
        static Periodo de(LocalDate inicio, LocalDate fin) {
            LocalDate f = fin != null ? fin : Combos.hoy();
            if (inicio != null && inicio.isAfter(f)) {
                throw new IllegalArgumentException("La fecha de inicio es posterior a la final.");
            }
            return new Periodo(inicio, f.plusDays(1));
        }
    }

    /**
     * Restaurante, sucursal y periodo. {@code sucursal} es la columna con el
     * branch_id y "b" el alias de branches; {@code fecha} es la columna a
     * filtrar y {@code esFecha} si es date (no timestamp).
     */
    private static String donde(UUID restaurantId, UUID branchId, Periodo periodo, String sucursal, String fecha,
                                boolean esFecha, MapSqlParameterSource p) {
        StringBuilder s = new StringBuilder();
        if (restaurantId != null) {
            s.append(" AND b.restaurant_id = :restaurantId");
            p.addValue("restaurantId", restaurantId);
        }
        if (branchId != null) {
            s.append(" AND ").append(sucursal).append(" = :branchId");
            p.addValue("branchId", branchId);
        }
        if (periodo.desde() != null) {
            s.append(" AND ").append(fecha).append(" >= :desde");
            p.addValue("desde", esFecha ? Date.valueOf(periodo.desde()) : Timestamp.valueOf(periodo.desde().atStartOfDay()));
        }
        s.append(" AND ").append(fecha).append(" < :hasta");
        p.addValue("hasta", esFecha ? Date.valueOf(periodo.hasta()) : Timestamp.valueOf(periodo.hasta().atStartOfDay()));
        return s.toString();
    }

    /** Salidas de caja que no pagaron una compra ni son propinas repartidas. */
    private static final String OTRA_SALIDA = " " + """
            m.tipo = 'SALIDA'
            AND m.concepto NOT ILIKE '%propina%'
            AND NOT EXISTS (SELECT 1 FROM compras c WHERE c.movimiento_caja_id = m.id OR c.pago_movimiento_caja_id = m.id)
            """;

    /**
     * La propina de una cuenta: unas la guardan en la cuenta y otras solo en
     * sus pagos; se toma la mayor (nunca se suman, seria la misma propina).
     */
    private static final String PROPINA = "GREATEST(COALESCE(o.propina, 0), COALESCE(pp.propina, 0))";
    private static final String PAGOS_DE_LA_CUENTA =
            " LEFT JOIN LATERAL (SELECT SUM(pg.propina) AS propina FROM pagos pg WHERE pg.order_id = o.id) pp ON true";

    @Transactional(readOnly = true)
    public FlujoDTOs.Flujo flujo(UUID restaurantId, UUID branchId, LocalDate inicio, LocalDate fin) {
        Periodo periodo = Periodo.de(inicio, fin);
        FlujoDTOs.Ingresos ingresos = ingresos(restaurantId, branchId, periodo);
        FlujoDTOs.Egresos egresos = egresos(restaurantId, branchId, periodo);
        return new FlujoDTOs.Flujo(
                ingresos,
                egresos,
                dinero(ingresos.total().subtract(egresos.total())),
                compradoSinPagar(restaurantId, branchId, periodo),
                propinas(restaurantId, branchId, periodo),
                porDia(restaurantId, branchId, periodo),
                porProveedor(restaurantId, branchId, periodo));
    }

    // ------------------------------------------------------------------ ingresos

    private FlujoDTOs.Ingresos ingresos(UUID restaurantId, UUID branchId, Periodo periodo) {
        MapSqlParameterSource p = new MapSqlParameterSource();
        String filtro = donde(restaurantId, branchId, periodo, "o.branch_id", "o.closed_at", false, p);
        Map<String, Object> t = jdbc().queryForMap("""
                SELECT COALESCE(SUM(o.total_amount + COALESCE(o.envio_cobrado, 0)), 0) AS total, COUNT(*) AS cuentas
                FROM orders o JOIN branches b ON b.id = o.branch_id
                WHERE o.status = 'CLOSED'""" + filtro, p);
        BigDecimal total = dinero((BigDecimal) t.get("total"));

        List<FlujoDTOs.Concepto> porMetodo = new ArrayList<>(jdbc().query("""
                SELECT pg.metodo AS nombre, SUM(pg.monto) AS monto
                FROM pagos pg JOIN orders o ON o.id = pg.order_id JOIN branches b ON b.id = o.branch_id
                WHERE o.status = 'CLOSED'""" + filtro + """

                GROUP BY pg.metodo ORDER BY monto DESC""", p, (rs, n) -> concepto(rs.getString("nombre"), rs.getBigDecimal("monto"))));
        // Cuentas sin pagos capturados (cobradas por el repartidor, o de antes de la caja).
        BigDecimal registrado = porMetodo.stream().map(FlujoDTOs.Concepto::monto).reduce(BigDecimal.ZERO, BigDecimal::add);
        if (total.subtract(registrado).compareTo(new BigDecimal("0.50")) > 0) {
            porMetodo.add(concepto("Sin forma de pago registrada", total.subtract(registrado)));
        }
        return new FlujoDTOs.Ingresos(total, ((Number) t.get("cuentas")).longValue(), porMetodo);
    }

    private FlujoDTOs.Propinas propinas(UUID restaurantId, UUID branchId, Periodo periodo) {
        MapSqlParameterSource p = new MapSqlParameterSource();
        String filtro = donde(restaurantId, branchId, periodo, "o.branch_id", "o.closed_at", false, p);
        BigDecimal total = dinero(jdbc().queryForObject("""
                SELECT COALESCE(SUM(""" + PROPINA + """
                ), 0) FROM orders o JOIN branches b ON b.id = o.branch_id""" + PAGOS_DE_LA_CUENTA + """

                WHERE o.status = 'CLOSED'""" + filtro, p, BigDecimal.class));
        BigDecimal enEfectivo = dinero(jdbc().queryForObject("""
                SELECT COALESCE(SUM(pg.propina), 0)
                FROM pagos pg JOIN orders o ON o.id = pg.order_id JOIN branches b ON b.id = o.branch_id
                WHERE o.status = 'CLOSED' AND pg.es_efectivo""" + filtro, p, BigDecimal.class));
        // Si la cuenta dejo propina pero sus pagos no la traen, sale de la caja para entregarse.
        BigDecimal otros = total.subtract(enEfectivo).max(BigDecimal.ZERO);

        List<FlujoDTOs.Concepto> porMesero = jdbc().query("""
                SELECT TRIM(m.nombre) AS nombre, SUM(""" + PROPINA + """
                 / m.cuantos) AS monto
                FROM orders o
                JOIN branches b ON b.id = o.branch_id""" + PAGOS_DE_LA_CUENTA + """

                CROSS JOIN LATERAL (
                    SELECT x AS nombre, cardinality(string_to_array(o.waiter_name, ',')) AS cuantos
                    FROM unnest(string_to_array(o.waiter_name, ',')) AS x
                ) m
                WHERE o.status = 'CLOSED' AND\s""" + PROPINA + """
                 > 0
                  AND o.waiter_name IS NOT NULL AND TRIM(o.waiter_name) <> ''""" + filtro + """

                GROUP BY TRIM(m.nombre) ORDER BY monto DESC""", p, (rs, n) -> concepto(rs.getString("nombre"), rs.getBigDecimal("monto")));

        MapSqlParameterSource q = new MapSqlParameterSource();
        BigDecimal repartidas = dinero(jdbc().queryForObject("""
                SELECT COALESCE(SUM(m.monto), 0)
                FROM movimientos_caja m JOIN turnos_caja t ON t.id = m.turno_id JOIN branches b ON b.id = t.branch_id
                WHERE m.tipo = 'SALIDA' AND m.concepto ILIKE '%propina%'"""
                + donde(restaurantId, branchId, periodo, "t.branch_id", "m.creado_en", false, q), q, BigDecimal.class));
        return new FlujoDTOs.Propinas(total, enEfectivo, dinero(otros), repartidas, porMesero);
    }

    // ------------------------------------------------------------------ egresos

    private FlujoDTOs.Egresos egresos(UUID restaurantId, UUID branchId, Periodo periodo) {
        MapSqlParameterSource p = new MapSqlParameterSource();
        Map<String, BigDecimal> contado = new HashMap<>();
        jdbc().query("""
                SELECT COALESCE(c.forma_pago, 'SIN') AS forma, COALESCE(SUM(c.total), 0) AS monto
                FROM compras c JOIN branches b ON b.id = c.branch_id
                WHERE c.anulada_en IS NULL AND COALESCE(c.forma_pago, 'SIN') <> 'CREDITO'"""
                + donde(restaurantId, branchId, periodo, "c.branch_id", "c.fecha", true, p) + """

                GROUP BY COALESCE(c.forma_pago, 'SIN')""", p, rs -> {
            contado.put(rs.getString("forma"), rs.getBigDecimal("monto"));
        });
        BigDecimal caja = dinero(contado.get("CAJA"));
        BigDecimal transferencia = dinero(contado.get("TRANSFERENCIA"));
        BigDecimal sinForma = dinero(contado.get("SIN"));

        MapSqlParameterSource q = new MapSqlParameterSource();
        BigDecimal pagosCredito = dinero(jdbc().queryForObject("""
                SELECT COALESCE(SUM(c.total), 0) FROM compras c JOIN branches b ON b.id = c.branch_id
                WHERE c.anulada_en IS NULL AND c.forma_pago = 'CREDITO' AND c.pagada_en IS NOT NULL"""
                + donde(restaurantId, branchId, periodo, "c.branch_id", "c.pagada_en", false, q), q, BigDecimal.class));

        MapSqlParameterSource r = new MapSqlParameterSource();
        List<FlujoDTOs.Salida> otras = jdbc().query("""
                SELECT m.creado_en, m.concepto, m.monto, m.por, b.name AS sucursal
                FROM movimientos_caja m JOIN turnos_caja t ON t.id = m.turno_id JOIN branches b ON b.id = t.branch_id
                WHERE """ + OTRA_SALIDA + donde(restaurantId, branchId, periodo, "t.branch_id", "m.creado_en", false, r) + """

                ORDER BY m.creado_en DESC""", r, (rs, n) -> new FlujoDTOs.Salida(
                rs.getTimestamp("creado_en").toLocalDateTime(), rs.getString("concepto"), dinero(rs.getBigDecimal("monto")),
                rs.getString("por"), rs.getString("sucursal")));
        BigDecimal otrasSalidas = otras.stream().map(FlujoDTOs.Salida::monto).reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal total = caja.add(transferencia).add(sinForma).add(pagosCredito).add(otrasSalidas);
        return new FlujoDTOs.Egresos(dinero(total), caja, transferencia, sinForma, pagosCredito, dinero(otrasSalidas),
                otras.size() > 100 ? otras.subList(0, 100) : otras);
    }

    private BigDecimal compradoSinPagar(UUID restaurantId, UUID branchId, Periodo periodo) {
        MapSqlParameterSource p = new MapSqlParameterSource();
        return dinero(jdbc().queryForObject("""
                SELECT COALESCE(SUM(c.total), 0) FROM compras c JOIN branches b ON b.id = c.branch_id
                WHERE c.anulada_en IS NULL AND c.forma_pago = 'CREDITO' AND c.pagada_en IS NULL"""
                + donde(restaurantId, branchId, periodo, "c.branch_id", "c.fecha", true, p), p, BigDecimal.class));
    }

    private List<FlujoDTOs.PorProveedor> porProveedor(UUID restaurantId, UUID branchId, Periodo periodo) {
        MapSqlParameterSource p = new MapSqlParameterSource();
        return jdbc().query("""
                SELECT COALESCE(NULLIF(TRIM(c.proveedor), ''), 'Sin proveedor') AS proveedor,
                       COUNT(*) AS notas,
                       COALESCE(SUM(c.total), 0) AS comprado,
                       COALESCE(SUM(c.total) FILTER (WHERE c.forma_pago <> 'CREDITO' OR c.forma_pago IS NULL OR c.pagada_en IS NOT NULL), 0) AS pagado,
                       COALESCE(SUM(c.total) FILTER (WHERE c.forma_pago = 'CREDITO' AND c.pagada_en IS NULL), 0) AS debe
                FROM compras c JOIN branches b ON b.id = c.branch_id
                WHERE c.anulada_en IS NULL"""
                + donde(restaurantId, branchId, periodo, "c.branch_id", "c.fecha", true, p) + """

                GROUP BY 1 ORDER BY comprado DESC""", p, (rs, n) -> new FlujoDTOs.PorProveedor(
                rs.getString("proveedor"), rs.getLong("notas"), dinero(rs.getBigDecimal("comprado")),
                dinero(rs.getBigDecimal("pagado")), dinero(rs.getBigDecimal("debe"))));
    }

    // ------------------------------------------------------------------ por dia

    private List<FlujoDTOs.Dia> porDia(UUID restaurantId, UUID branchId, Periodo periodo) {
        TreeMap<LocalDate, BigDecimal[]> dias = new TreeMap<>();
        if (periodo.desde() != null && ChronoUnit.DAYS.between(periodo.desde(), periodo.hasta()) <= DIAS_A_RELLENAR) {
            for (LocalDate d = periodo.desde(); d.isBefore(periodo.hasta()); d = d.plusDays(1)) {
                dias.put(d, new BigDecimal[]{BigDecimal.ZERO, BigDecimal.ZERO});
            }
        }
        sumarPorDia(dias, 0, """
                SELECT o.closed_at::date AS dia, SUM(o.total_amount + COALESCE(o.envio_cobrado, 0)) AS monto
                FROM orders o JOIN branches b ON b.id = o.branch_id
                WHERE o.status = 'CLOSED'%s GROUP BY 1""", restaurantId, branchId, periodo, "o.branch_id", "o.closed_at", false);
        sumarPorDia(dias, 1, """
                SELECT c.fecha AS dia, SUM(c.total) AS monto
                FROM compras c JOIN branches b ON b.id = c.branch_id
                WHERE c.anulada_en IS NULL AND COALESCE(c.forma_pago, 'SIN') <> 'CREDITO'%s GROUP BY 1""",
                restaurantId, branchId, periodo, "c.branch_id", "c.fecha", true);
        sumarPorDia(dias, 1, """
                SELECT c.pagada_en::date AS dia, SUM(c.total) AS monto
                FROM compras c JOIN branches b ON b.id = c.branch_id
                WHERE c.anulada_en IS NULL AND c.forma_pago = 'CREDITO' AND c.pagada_en IS NOT NULL%s GROUP BY 1""",
                restaurantId, branchId, periodo, "c.branch_id", "c.pagada_en", false);
        sumarPorDia(dias, 1, """
                SELECT m.creado_en::date AS dia, SUM(m.monto) AS monto
                FROM movimientos_caja m JOIN turnos_caja t ON t.id = m.turno_id JOIN branches b ON b.id = t.branch_id
                WHERE """ + OTRA_SALIDA.replace("%", "%%") + "%s GROUP BY 1",
                restaurantId, branchId, periodo, "t.branch_id", "m.creado_en", false);
        return dias.entrySet().stream()
                .map(e -> new FlujoDTOs.Dia(e.getKey(), dinero(e.getValue()[0]), dinero(e.getValue()[1])))
                .toList();
    }

    private void sumarPorDia(TreeMap<LocalDate, BigDecimal[]> dias, int columna, String plantilla, UUID restaurantId,
                             UUID branchId, Periodo periodo, String sucursal, String fecha, boolean esFecha) {
        MapSqlParameterSource p = new MapSqlParameterSource();
        String sql = String.format(plantilla, donde(restaurantId, branchId, periodo, sucursal, fecha, esFecha, p));
        jdbc().query(sql, p, rs -> {
            LocalDate dia = rs.getDate("dia").toLocalDate();
            dias.computeIfAbsent(dia, k -> new BigDecimal[]{BigDecimal.ZERO, BigDecimal.ZERO})[columna] =
                    dias.get(dia)[columna].add(rs.getBigDecimal("monto"));
        });
    }

    // ------------------------------------------------------------------

    private static FlujoDTOs.Concepto concepto(String nombre, BigDecimal monto) {
        return new FlujoDTOs.Concepto(nombre, dinero(monto));
    }

    private static BigDecimal dinero(BigDecimal n) {
        return (n != null ? n : BigDecimal.ZERO).setScale(2, RoundingMode.HALF_UP);
    }
}
