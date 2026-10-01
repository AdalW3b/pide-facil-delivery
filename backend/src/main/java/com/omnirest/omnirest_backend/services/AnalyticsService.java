package com.omnirest.omnirest_backend.services;

import com.omnirest.omnirest_backend.domain.entities.Product;
import com.omnirest.omnirest_backend.dtos.AnalyticsSummaryDTO;
import com.omnirest.omnirest_backend.dtos.CanalVentasDTO;
import com.omnirest.omnirest_backend.dtos.DailySalesDTO;
import com.omnirest.omnirest_backend.dtos.EmployeePerformanceDTO;
import com.omnirest.omnirest_backend.dtos.KdsEfficiencyDTO;
import com.omnirest.omnirest_backend.dtos.PeakHourDTO;
import com.omnirest.omnirest_backend.dtos.ProductPerformanceDTO;
import com.omnirest.omnirest_backend.dtos.TablePerformanceDTO;
import com.omnirest.omnirest_backend.dtos.TurnaroundTimeDTO;
import com.omnirest.omnirest_backend.repositories.ProductRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Reportes. Todo se calcula al momento sobre las ordenes: nada de vistas que
 * se quedan viejas.
 *
 * Reglas comunes:
 *  - Una venta es una orden cobrada (CLOSED) y cuenta el dia en que se cobro.
 *  - "Ventas" es la comida (total_amount); envio y propina se reportan aparte.
 *  - Los platillos cancelados no cuentan.
 *  - Sin fecha de inicio es el historico completo; sin fecha final, hasta hoy.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class AnalyticsService {

    private final JdbcTemplate jdbcTemplate;
    private final ProductRepository productRepository;

    private NamedParameterJdbcTemplate jdbc() {
        return new NamedParameterJdbcTemplate(jdbcTemplate);
    }

    /** [desde, hasta): desde null = sin limite. */
    record Rango(LocalDateTime desde, LocalDateTime hasta) {
        static Rango de(LocalDate inicio, LocalDate fin) {
            LocalDate hasta = fin != null ? fin : LocalDate.now();
            if (inicio != null && inicio.isAfter(hasta)) {
                throw new IllegalArgumentException("La fecha de inicio es posterior a la final.");
            }
            return new Rango(inicio != null ? inicio.atStartOfDay() : null, hasta.plusDays(1).atStartOfDay());
        }

        /** El periodo inmediato anterior del mismo largo; null en el historico. */
        Rango anterior() {
            if (desde == null) return null;
            long dias = ChronoUnit.DAYS.between(desde, hasta);
            return new Rango(desde.minusDays(dias), desde);
        }
    }

    /** Condiciones de restaurante, sucursal y fechas sobre "o" (orders) y "b" (branches). */
    private static String filtro(UUID restaurantId, UUID branchId, Rango rango, String columnaFecha,
                                 MapSqlParameterSource p) {
        StringBuilder s = new StringBuilder();
        if (restaurantId != null) {
            s.append(" AND b.restaurant_id = :restaurantId");
            p.addValue("restaurantId", restaurantId);
        }
        if (branchId != null) {
            s.append(" AND o.branch_id = :branchId");
            p.addValue("branchId", branchId);
        }
        if (rango.desde() != null) {
            s.append(" AND ").append(columnaFecha).append(" >= :desde");
            p.addValue("desde", Timestamp.valueOf(rango.desde()));
        }
        s.append(" AND ").append(columnaFecha).append(" < :hasta");
        p.addValue("hasta", Timestamp.valueOf(rango.hasta()));
        return s.toString();
    }

    // ------------------------------------------------------------------ resumen

    private record Totales(BigDecimal ventas, long ordenes, long mesas, BigDecimal envio, BigDecimal propinas) {
        BigDecimal ticket() {
            return ordenes > 0 ? ventas.divide(BigDecimal.valueOf(ordenes), 2, RoundingMode.HALF_UP) : BigDecimal.ZERO;
        }
    }

    private Totales totales(UUID restaurantId, UUID branchId, Rango rango) {
        MapSqlParameterSource p = new MapSqlParameterSource();
        String sql = """
            SELECT COALESCE(SUM(o.total_amount), 0) AS ventas,
                   COUNT(*) AS ordenes,
                   COUNT(*) FILTER (WHERE o.table_id IS NOT NULL) AS mesas,
                   COALESCE(SUM(o.envio_cobrado), 0) AS envio,
                   COALESCE(SUM(o.propina), 0) AS propinas
            FROM orders o
            JOIN branches b ON b.id = o.branch_id
            WHERE o.status = 'CLOSED'
            """ + filtro(restaurantId, branchId, rango, "o.closed_at", p);
        return jdbc().queryForObject(sql, p, (rs, n) -> new Totales(
                rs.getBigDecimal("ventas").setScale(2, RoundingMode.HALF_UP),
                rs.getLong("ordenes"),
                rs.getLong("mesas"),
                rs.getBigDecimal("envio").setScale(2, RoundingMode.HALF_UP),
                rs.getBigDecimal("propinas").setScale(2, RoundingMode.HALF_UP)));
    }

    @Transactional(readOnly = true)
    public AnalyticsSummaryDTO getAnalyticsSummary(UUID restaurantId, UUID branchId, LocalDate startDate, LocalDate endDate) {
        Rango rango = Rango.de(startDate, endDate);
        Totales hoy = totales(restaurantId, branchId, rango);
        Rango previo = rango.anterior();
        Totales antes = previo != null ? totales(restaurantId, branchId, previo) : null;

        MapSqlParameterSource p = new MapSqlParameterSource();
        Long canceladas = jdbc().queryForObject("""
            SELECT COUNT(*) FROM orders o JOIN branches b ON b.id = o.branch_id
            WHERE o.status = 'CANCELLED'
            """ + filtro(restaurantId, branchId, rango, "o.created_at", p), p, Long.class);

        // Costo de lo vendido: cada platillo por su costo de hoy.
        List<ProductPerformanceDTO> vendidos = productos(restaurantId, branchId, rango, Integer.MAX_VALUE);
        BigDecimal costo = BigDecimal.ZERO;
        int sinCosto = 0;
        boolean completo = true;
        for (ProductPerformanceDTO v : vendidos) {
            if (v.costoTotal() == null) {
                sinCosto++;
                completo = false;
                continue;
            }
            costo = costo.add(v.costoTotal());
            completo &= v.costoCompleto();
        }
        costo = costo.setScale(2, RoundingMode.HALF_UP);
        BigDecimal utilidad = hoy.ventas().subtract(costo);
        Double margen = hoy.ventas().signum() > 0
                ? porcentaje(utilidad, hoy.ventas())
                : null;

        return new AnalyticsSummaryDTO(
                hoy.ventas(), antes != null ? crecimiento(hoy.ventas().doubleValue(), antes.ventas().doubleValue()) : null,
                hoy.mesas(), antes != null ? crecimiento(hoy.mesas(), antes.mesas()) : null,
                hoy.ticket(), antes != null ? crecimiento(hoy.ticket().doubleValue(), antes.ticket().doubleValue()) : null,
                hoy.ordenes(), antes != null ? crecimiento(hoy.ordenes(), antes.ordenes()) : null,
                hoy.envio(), hoy.propinas(), canceladas != null ? canceladas : 0L,
                costo, utilidad, margen, completo && !vendidos.isEmpty(), sinCosto);
    }

    /** Cambio contra el periodo anterior; null si antes no hubo nada (no hay base). */
    static Double crecimiento(double actual, double anterior) {
        if (anterior == 0) return null;
        return Math.round(((actual - anterior) / anterior) * 1000.0) / 10.0;
    }

    private static Double porcentaje(BigDecimal parte, BigDecimal total) {
        return parte.multiply(BigDecimal.valueOf(100)).divide(total, 1, RoundingMode.HALF_UP).doubleValue();
    }

    // ------------------------------------------------------------------ por dia

    /**
     * Ventas por dia, sumando todas las sucursales del alcance. Los dias sin
     * ventas salen en cero para que la grafica no brinque de un dia a otro.
     */
    public List<DailySalesDTO> getDailySales(UUID restaurantId, UUID branchId, LocalDate startDate, LocalDate endDate) {
        Rango rango = Rango.de(startDate, endDate);
        MapSqlParameterSource p = new MapSqlParameterSource();
        String sql = """
            SELECT CAST(o.closed_at AS date) AS dia, COUNT(*) AS ordenes, SUM(o.total_amount) AS ventas
            FROM orders o
            JOIN branches b ON b.id = o.branch_id
            WHERE o.status = 'CLOSED'
            """ + filtro(restaurantId, branchId, rango, "o.closed_at", p) + """

            GROUP BY CAST(o.closed_at AS date)
            ORDER BY dia
            """;
        Map<LocalDate, DailySalesDTO> porDia = new LinkedHashMap<>();
        jdbc().query(sql, p, rs -> {
            LocalDate dia = rs.getDate("dia").toLocalDate();
            porDia.put(dia, new DailySalesDTO(restaurantId, branchId, dia, rs.getLong("ordenes"),
                    rs.getBigDecimal("ventas").setScale(2, RoundingMode.HALF_UP)));
        });

        LocalDate ultimo = rango.hasta().toLocalDate().minusDays(1);
        LocalDate primero = rango.desde() != null ? rango.desde().toLocalDate()
                : porDia.keySet().stream().findFirst().orElse(ultimo);
        List<DailySalesDTO> dias = new ArrayList<>();
        for (LocalDate d = primero; !d.isAfter(ultimo); d = d.plusDays(1)) {
            dias.add(porDia.getOrDefault(d, new DailySalesDTO(restaurantId, branchId, d, 0L, BigDecimal.ZERO)));
        }
        return dias;
    }

    // ------------------------------------------------------------------ canales

    public List<CanalVentasDTO> getVentasPorCanal(UUID restaurantId, UUID branchId, LocalDate startDate, LocalDate endDate) {
        MapSqlParameterSource p = new MapSqlParameterSource();
        String sql = """
            SELECT COALESCE(o.order_type, 'SALON') AS tipo,
                   CASE WHEN COALESCE(o.order_type, 'SALON') = 'SALON' THEN NULL ELSE o.origen END AS origen,
                   COUNT(*) AS ordenes,
                   COALESCE(SUM(o.total_amount), 0) AS ventas,
                   COALESCE(SUM(o.envio_cobrado), 0) AS envio,
                   COALESCE(SUM(o.propina), 0) AS propinas
            FROM orders o
            JOIN branches b ON b.id = o.branch_id
            WHERE o.status = 'CLOSED'
            """ + filtro(restaurantId, branchId, Rango.de(startDate, endDate), "o.closed_at", p) + """

            GROUP BY 1, 2
            ORDER BY ventas DESC
            """;
        return jdbc().query(sql, p, (rs, n) -> new CanalVentasDTO(
                rs.getString("tipo"), rs.getString("origen"), rs.getLong("ordenes"),
                rs.getBigDecimal("ventas"), rs.getBigDecimal("envio"), rs.getBigDecimal("propinas")));
    }

    // ------------------------------------------------------------------ personal

    /**
     * Ventas por mesero. Se usa el nombre que quedo guardado en la cuenta al
     * cobrarla (no la asignacion de mesas de hoy, que cambia). Si la mesa la
     * atendian dos, la venta se reparte entre ambos.
     */
    public List<EmployeePerformanceDTO> getEmployeePerformance(UUID restaurantId, UUID branchId, LocalDate startDate, LocalDate endDate) {
        MapSqlParameterSource p = new MapSqlParameterSource();
        String sql = """
            SELECT TRIM(m.nombre) AS mesero,
                   COUNT(DISTINCT o.id) AS ordenes,
                   SUM(o.total_amount / m.cuantos) AS ventas,
                   STRING_AGG(DISTINCT b.name, ', ') AS sucursales
            FROM orders o
            JOIN branches b ON b.id = o.branch_id
            CROSS JOIN LATERAL (
                SELECT x AS nombre, cardinality(string_to_array(o.waiter_name, ',')) AS cuantos
                FROM unnest(string_to_array(o.waiter_name, ',')) AS x
            ) m
            WHERE o.status = 'CLOSED'
              AND o.waiter_name IS NOT NULL AND TRIM(o.waiter_name) <> ''
            """ + filtro(restaurantId, branchId, Rango.de(startDate, endDate), "o.closed_at", p) + """

            GROUP BY TRIM(m.nombre)
            ORDER BY ventas DESC
            """;
        return jdbc().query(sql, p, (rs, n) -> new EmployeePerformanceDTO(
                null, rs.getString("mesero"), rs.getLong("ordenes"),
                rs.getBigDecimal("ventas").setScale(2, RoundingMode.HALF_UP), rs.getString("sucursales")));
    }

    // ------------------------------------------------------------------ mesas

    public List<TablePerformanceDTO> getTablePerformance(UUID restaurantId, UUID branchId, LocalDate startDate, LocalDate endDate) {
        MapSqlParameterSource p = new MapSqlParameterSource();
        String sql = """
            SELECT t.table_number, b.name AS sucursal, COUNT(o.id) AS ordenes, SUM(o.total_amount) AS ventas
            FROM orders o
            JOIN tables t ON t.id = o.table_id
            JOIN branches b ON b.id = o.branch_id
            WHERE o.status = 'CLOSED'
            """ + filtro(restaurantId, branchId, Rango.de(startDate, endDate), "o.closed_at", p) + """

            GROUP BY t.id, t.table_number, b.name
            ORDER BY ventas DESC
            """;
        return jdbc().query(sql, p, (rs, n) -> new TablePerformanceDTO(
                rs.getInt("table_number"), rs.getLong("ordenes"), rs.getBigDecimal("ventas"), rs.getString("sucursal")));
    }

    /**
     * Minutos que dura ocupada cada mesa (de que se abre la cuenta a que se
     * cobra). Las cuentas de mas de 12 horas son mesas que se olvidaron de
     * cerrar y no se cuentan: una sola subia el promedio a cientos de minutos.
     */
    public List<TurnaroundTimeDTO> getTableTurnaround(UUID restaurantId, UUID branchId, LocalDate startDate, LocalDate endDate) {
        MapSqlParameterSource p = new MapSqlParameterSource();
        String sql = """
            SELECT t.table_number, b.name AS sucursal,
                   CAST(ROUND(AVG(EXTRACT(EPOCH FROM (o.closed_at - o.created_at)) / 60)) AS BIGINT) AS minutos,
                   COUNT(o.id) AS ordenes
            FROM orders o
            JOIN tables t ON t.id = o.table_id
            JOIN branches b ON b.id = o.branch_id
            WHERE o.status = 'CLOSED'
              AND o.created_at IS NOT NULL
              AND o.closed_at - o.created_at < INTERVAL '12 hours'
            """ + filtro(restaurantId, branchId, Rango.de(startDate, endDate), "o.closed_at", p) + """

            GROUP BY t.id, t.table_number, b.name
            ORDER BY minutos DESC
            LIMIT 10
            """;
        return jdbc().query(sql, p, (rs, n) -> new TurnaroundTimeDTO(
                rs.getInt("table_number"), rs.getLong("minutos"), rs.getLong("ordenes"), rs.getString("sucursal")));
    }

    // ------------------------------------------------------------------ platillos

    @Transactional(readOnly = true)
    public List<ProductPerformanceDTO> getTopSellingProducts(UUID restaurantId, UUID branchId, LocalDate startDate,
                                                             LocalDate endDate, int limite) {
        return productos(restaurantId, branchId, Rango.de(startDate, endDate), limite);
    }

    /**
     * Platillos vendidos con su costo de hoy. Se juntan todas las sucursales
     * del alcance: antes salia un renglon por sucursal y el mismo platillo
     * aparecia dos veces en el top.
     */
    private List<ProductPerformanceDTO> productos(UUID restaurantId, UUID branchId, Rango rango, int limite) {
        MapSqlParameterSource p = new MapSqlParameterSource();
        p.addValue("limite", limite);
        String sql = """
            SELECT oi.product_id, p.name AS nombre,
                   SUM(oi.quantity) AS piezas,
                   SUM(oi.unit_price * oi.quantity) AS ventas,
                   STRING_AGG(DISTINCT b.name, ', ') AS sucursales
            FROM order_items oi
            JOIN orders o ON o.id = oi.order_id
            JOIN products p ON p.id = oi.product_id
            JOIN branches b ON b.id = o.branch_id
            WHERE o.status = 'CLOSED'
              AND oi.kitchen_status <> 'CANCELLED'
            """ + filtro(restaurantId, branchId, rango, "o.closed_at", p) + """

            GROUP BY oi.product_id, p.name
            ORDER BY piezas DESC, ventas DESC
            LIMIT :limite
            """;
        record Fila(UUID id, String nombre, long piezas, BigDecimal ventas, String sucursales) {
        }
        List<Fila> filas = jdbc().query(sql, p, (rs, n) -> new Fila(
                rs.getObject("product_id", UUID.class), rs.getString("nombre"), rs.getLong("piezas"),
                rs.getBigDecimal("ventas").setScale(2, RoundingMode.HALF_UP), rs.getString("sucursales")));
        if (filas.isEmpty()) return List.of();

        Map<UUID, Product> productos = productRepository.findAllById(filas.stream().map(Fila::id).toList())
                .stream().collect(Collectors.toMap(Product::getId, Function.identity()));
        List<ProductPerformanceDTO> res = new ArrayList<>(filas.size());
        for (Fila f : filas) {
            Product prod = productos.get(f.id());
            Costos.Costo c = prod != null ? Costos.dePlatillo(prod, prod.getRecipeItems()) : null;
            BigDecimal unitario = c != null ? c.valor() : null;
            BigDecimal costoTotal = unitario != null
                    ? unitario.multiply(BigDecimal.valueOf(f.piezas())).setScale(2, RoundingMode.HALF_UP) : null;
            BigDecimal utilidad = costoTotal != null ? f.ventas().subtract(costoTotal) : null;
            Double margen = utilidad != null && f.ventas().signum() > 0 ? porcentaje(utilidad, f.ventas()) : null;
            String categoria = prod != null && prod.getCategory() != null ? prod.getCategory().getName() : null;
            res.add(new ProductPerformanceDTO(f.id(), f.nombre(), f.piezas(), f.ventas(), f.sucursales(), categoria,
                    unitario, costoTotal, utilidad, margen, c != null && c.completo()));
        }
        return res;
    }

    // ------------------------------------------------------------------ horas pico

    /** Ordenes por dia de la semana y hora en que se abrieron (para el mapa de calor). */
    public List<PeakHourDTO> getPeakHours(UUID restaurantId, UUID branchId, LocalDate startDate, LocalDate endDate) {
        MapSqlParameterSource p = new MapSqlParameterSource();
        String sql = """
            SELECT CAST(EXTRACT(ISODOW FROM o.created_at) AS INTEGER) AS dia,
                   CAST(EXTRACT(HOUR FROM o.created_at) AS INTEGER) AS hora,
                   COUNT(*) AS ordenes,
                   COALESCE(SUM(o.total_amount), 0) AS ventas
            FROM orders o
            JOIN branches b ON b.id = o.branch_id
            WHERE o.status = 'CLOSED'
              AND o.created_at IS NOT NULL
            """ + filtro(restaurantId, branchId, Rango.de(startDate, endDate), "o.created_at", p) + """

            GROUP BY 1, 2
            ORDER BY 1, 2
            """;
        return jdbc().query(sql, p, (rs, n) -> new PeakHourDTO(
                rs.getInt("hora"), rs.getLong("ordenes"), rs.getBigDecimal("ventas"), rs.getInt("dia")));
    }

    // ------------------------------------------------------------------ cocina

    /**
     * Minutos de cocina por platillo: de que se pidio a que se marco listo.
     * Los platillos de antes de que se guardara la hora de cada uno usan la
     * hora de la cuenta. Mas de 3 horas es un platillo que nadie marco a
     * tiempo y no se cuenta.
     */
    public List<KdsEfficiencyDTO> getKdsEfficiency(UUID restaurantId, UUID branchId, LocalDate startDate, LocalDate endDate) {
        MapSqlParameterSource p = new MapSqlParameterSource();
        String sql = """
            SELECT p.name AS nombre,
                   CAST(ROUND(AVG(EXTRACT(EPOCH FROM (oi.ready_at - COALESCE(oi.created_at, o.created_at))) / 60)) AS BIGINT) AS minutos,
                   STRING_AGG(DISTINCT b.name, ', ') AS sucursales,
                   SUM(oi.quantity) AS piezas
            FROM order_items oi
            JOIN orders o ON o.id = oi.order_id
            JOIN products p ON p.id = oi.product_id
            JOIN branches b ON b.id = o.branch_id
            WHERE oi.ready_at IS NOT NULL
              AND oi.kitchen_status <> 'CANCELLED'
              AND oi.ready_at >= COALESCE(oi.created_at, o.created_at)
              AND oi.ready_at - COALESCE(oi.created_at, o.created_at) < INTERVAL '3 hours'
            """ + filtro(restaurantId, branchId, Rango.de(startDate, endDate), "o.created_at", p) + """

            GROUP BY p.id, p.name
            ORDER BY minutos DESC
            LIMIT 10
            """;
        return jdbc().query(sql, p, (rs, n) -> new KdsEfficiencyDTO(
                rs.getString("nombre"), rs.getLong("minutos"), rs.getString("sucursales"), rs.getLong("piezas")));
    }

    /**
     * La vista mv_daily_sales ya no se lee (las ventas por dia se calculan al
     * momento); se sigue refrescando solo mientras exista en la base.
     */
    public void refreshDailySalesView() {
        jdbcTemplate.execute("REFRESH MATERIALIZED VIEW CONCURRENTLY mv_daily_sales");
    }
}
