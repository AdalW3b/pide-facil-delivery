package com.omnirest.omnirest_backend.services;

import com.omnirest.omnirest_backend.dtos.AnalyticsSummaryDTO;
import com.omnirest.omnirest_backend.dtos.DailySalesDTO;
import com.omnirest.omnirest_backend.dtos.EmployeePerformanceDTO;
import com.omnirest.omnirest_backend.dtos.KdsEfficiencyDTO;
import com.omnirest.omnirest_backend.dtos.PeakHourDTO;
import com.omnirest.omnirest_backend.dtos.ProductPerformanceDTO;
import com.omnirest.omnirest_backend.dtos.TablePerformanceDTO;
import com.omnirest.omnirest_backend.dtos.TurnaroundTimeDTO;
import com.omnirest.omnirest_backend.repositories.DailySalesViewRepository;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.sql.Date;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class AnalyticsService {

    private final DailySalesViewRepository dailySalesViewRepository;
    private final JdbcTemplate jdbcTemplate;

    @PostConstruct
    public void initRefresh() {
        try {
            refreshDailySalesView();
        } catch (Exception e) {
            log.warn("Inicialización de vista materializada omitida o fallida: {}", e.getMessage());
        }
    }

    public List<DailySalesDTO> getDailySales(UUID restaurantId, UUID branchId, LocalDate startDate, LocalDate endDate) {
        if (startDate == null) {
            startDate = LocalDate.now().minusDays(30);
        }
        if (endDate == null) {
            endDate = LocalDate.now();
        }
        
        List<DailySalesDTO> results = null;
        
        // 1. Intentar leer de la vista materializada (Protegido con try-catch)
        try {
            results = dailySalesViewRepository.findDailySales(restaurantId, branchId, startDate, endDate);
        } catch (Exception e) {
            log.warn("La vista materializada falló o no tiene la estructura correcta. Intentando refrescar...");
        }

        // 2. Si falló o está vacía, intentar refrescar
        if (results == null || results.isEmpty()) {
            try {
                refreshDailySalesView();
                results = dailySalesViewRepository.findDailySales(restaurantId, branchId, startDate, endDate);
            } catch (Exception e) {
                log.warn("Error al intentar refrescar vista materializada: {}", e.getMessage());
            }
        }

        // 3. Fallback final: Consulta directa sobre la tabla original 'orders'
        if (results == null || results.isEmpty()) {
            try {
                results = queryDirectOrdersDailySales(restaurantId, branchId, startDate, endDate);
            } catch (Exception e) {
                log.error("Error en consulta directa de fallback: {}", e.getMessage());
                return new ArrayList<>(); // Evitar Error 500 devolviendo lista vacía
            }
        }

        return results;
    }

    private List<DailySalesDTO> queryDirectOrdersDailySales(UUID restaurantId, UUID branchId, LocalDate startDate, LocalDate endDate) {
        String sql = """
            SELECT 
                b.restaurant_id,
                o.branch_id,
                DATE(o.closed_at) as sale_date,
                COUNT(o.id) as total_orders,
                SUM(o.total_amount) as total_revenue
            FROM orders o
            JOIN branches b ON o.branch_id = b.id
            WHERE o.status = 'CLOSED'
              AND (CAST(? AS text) IS NULL OR b.restaurant_id = CAST(? AS uuid))
              AND (CAST(? AS text) IS NULL OR o.branch_id = CAST(? AS uuid))
              AND DATE(o.closed_at) BETWEEN ? AND ?
            GROUP BY b.restaurant_id, o.branch_id, DATE(o.closed_at)
            ORDER BY sale_date ASC
        """;
        
        String restIdStr = restaurantId != null ? restaurantId.toString() : null;
        String branchIdStr = branchId != null ? branchId.toString() : null;
        
        return jdbcTemplate.query(
            sql,
            (rs, rowNum) -> new DailySalesDTO(
                rs.getObject("restaurant_id", UUID.class),
                rs.getObject("branch_id", UUID.class),
                rs.getDate("sale_date").toLocalDate(),
                rs.getLong("total_orders"),
                rs.getBigDecimal("total_revenue")
            ),
            restIdStr, restIdStr,
            branchIdStr, branchIdStr,
            Date.valueOf(startDate), Date.valueOf(endDate)
        );
    }

    @Transactional(readOnly = true)
    public AnalyticsSummaryDTO getAnalyticsSummary(UUID restaurantId, UUID branchId, LocalDate startDate, LocalDate endDate) {
        if (startDate == null) startDate = LocalDate.now().minusDays(30);
        if (endDate == null) endDate = LocalDate.now();

        long daysBetween = java.time.temporal.ChronoUnit.DAYS.between(startDate, endDate) + 1;
        LocalDate previousStartDate = startDate.minusDays(daysBetween);
        LocalDate previousEndDate = startDate.minusDays(1);

        String sql = """
            SELECT 
                COALESCE(SUM(CASE WHEN DATE(o.closed_at) BETWEEN ? AND ? THEN o.total_amount ELSE 0 END), 0) as current_sales,
                COALESCE(SUM(CASE WHEN DATE(o.closed_at) BETWEEN ? AND ? THEN o.total_amount ELSE 0 END), 0) as previous_sales,
                COUNT(CASE WHEN DATE(o.closed_at) BETWEEN ? AND ? THEN o.id ELSE NULL END) as current_orders,
                COUNT(CASE WHEN DATE(o.closed_at) BETWEEN ? AND ? THEN o.id ELSE NULL END) as previous_orders,
                COUNT(DISTINCT CASE WHEN DATE(o.closed_at) BETWEEN ? AND ? THEN o.table_id ELSE NULL END) as current_tables,
                COUNT(DISTINCT CASE WHEN DATE(o.closed_at) BETWEEN ? AND ? THEN o.table_id ELSE NULL END) as previous_tables
            FROM orders o
            JOIN branches b ON o.branch_id = b.id
            WHERE o.status = 'CLOSED'
              AND (CAST(? AS text) IS NULL OR b.restaurant_id = CAST(? AS uuid))
              AND (CAST(? AS text) IS NULL OR o.branch_id = CAST(? AS uuid))
        """;

        String restIdStr = restaurantId != null ? restaurantId.toString() : null;
        String branchIdStr = branchId != null ? branchId.toString() : null;

        java.sql.Date curStart = java.sql.Date.valueOf(startDate);
        java.sql.Date curEnd = java.sql.Date.valueOf(endDate);
        java.sql.Date prevStart = java.sql.Date.valueOf(previousStartDate);
        java.sql.Date prevEnd = java.sql.Date.valueOf(previousEndDate);

        Map<String, Object> row = jdbcTemplate.queryForMap(
            sql,
            curStart, curEnd, prevStart, prevEnd,
            curStart, curEnd, prevStart, prevEnd,
            curStart, curEnd, prevStart, prevEnd,
            restIdStr, restIdStr, branchIdStr, branchIdStr
        );

        BigDecimal todaySales = new BigDecimal(row.get("current_sales").toString()).setScale(2, RoundingMode.HALF_UP);
        BigDecimal yesterdaySales = new BigDecimal(row.get("previous_sales").toString()).setScale(2, RoundingMode.HALF_UP);
        long todayOrders = ((Number) row.get("current_orders")).longValue();
        long yesterdayOrders = ((Number) row.get("previous_orders")).longValue();
        long todayTables = ((Number) row.get("current_tables")).longValue();
        long yesterdayTables = ((Number) row.get("previous_tables")).longValue();

        BigDecimal averageTicketToday = todayOrders > 0 ? todaySales.divide(BigDecimal.valueOf(todayOrders), 2, RoundingMode.HALF_UP) : BigDecimal.ZERO;
        BigDecimal averageTicketYesterday = yesterdayOrders > 0 ? yesterdaySales.divide(BigDecimal.valueOf(yesterdayOrders), 2, RoundingMode.HALF_UP) : BigDecimal.ZERO;

        return new AnalyticsSummaryDTO(
            todaySales, calculateGrowth(todaySales.doubleValue(), yesterdaySales.doubleValue()),
            todayTables, calculateGrowth(todayTables, yesterdayTables),
            averageTicketToday, calculateGrowth(averageTicketToday.doubleValue(), averageTicketYesterday.doubleValue()),
            todayOrders, calculateGrowth(todayOrders, yesterdayOrders)
        );
    }

    private double calculateGrowth(double current, double previous) {
        if (previous == 0) {
            return current > 0 ? 100.0 : 0.0;
        }
        return Math.round(((current - previous) / previous) * 1000.0) / 10.0;
    }

    public List<EmployeePerformanceDTO> getEmployeePerformance(UUID restaurantId, UUID branchId, LocalDate startDate, LocalDate endDate) {
        if (startDate == null) startDate = LocalDate.now().minusDays(30);
        if (endDate == null) endDate = LocalDate.now();

        String sql = """
            SELECT 
                u.id as employee_id,
                u.name as employee_name,
                b.name as branch_name,
                COUNT(DISTINCT o.id) as total_orders,
                SUM(o.total_amount) as total_revenue
            FROM users u
            JOIN user_tables ut ON u.id = ut.user_id
            JOIN orders o ON ut.table_id = o.table_id
            JOIN branches b ON o.branch_id = b.id
            WHERE o.status = 'CLOSED'
              AND (CAST(? AS text) IS NULL OR b.restaurant_id = CAST(? AS uuid))
              AND (CAST(? AS text) IS NULL OR o.branch_id = CAST(? AS uuid))
              AND DATE(o.closed_at) BETWEEN ? AND ?
            GROUP BY u.id, u.name, b.name
            ORDER BY total_revenue DESC
        """;

        String restIdStr = restaurantId != null ? restaurantId.toString() : null;
        String branchIdStr = branchId != null ? branchId.toString() : null;

        return jdbcTemplate.query(
            sql,
            (rs, rowNum) -> new EmployeePerformanceDTO(
                rs.getObject("employee_id", UUID.class),
                rs.getString("employee_name"),
                rs.getLong("total_orders"),
                rs.getBigDecimal("total_revenue"),
                rs.getString("branch_name")
            ),
            restIdStr, restIdStr, branchIdStr, branchIdStr,
            Date.valueOf(startDate), Date.valueOf(endDate)
        );
    }

    public List<TablePerformanceDTO> getTablePerformance(UUID restaurantId, UUID branchId, LocalDate startDate, LocalDate endDate) {
        if (startDate == null) startDate = LocalDate.now().minusDays(30);
        if (endDate == null) endDate = LocalDate.now();

        String sql = """
            SELECT 
                t.table_number,
                b.name as branch_name,
                COUNT(o.id) as total_orders,
                SUM(o.total_amount) as total_revenue
            FROM orders o
            JOIN tables t ON o.table_id = t.id
            JOIN branches b ON o.branch_id = b.id
            WHERE o.status = 'CLOSED'
              AND (CAST(? AS text) IS NULL OR b.restaurant_id = CAST(? AS uuid))
              AND (CAST(? AS text) IS NULL OR o.branch_id = CAST(? AS uuid))
              AND DATE(o.closed_at) BETWEEN ? AND ?
            GROUP BY t.id, t.table_number, b.name
            ORDER BY total_revenue DESC
        """;

        String restIdStr = restaurantId != null ? restaurantId.toString() : null;
        String branchIdStr = branchId != null ? branchId.toString() : null;

        return jdbcTemplate.query(
            sql,
            (rs, rowNum) -> new TablePerformanceDTO(
                rs.getInt("table_number"),
                rs.getLong("total_orders"),
                rs.getBigDecimal("total_revenue"),
                rs.getString("branch_name")
            ),
            restIdStr, restIdStr, branchIdStr, branchIdStr,
            Date.valueOf(startDate), Date.valueOf(endDate)
        );
    }

    public List<ProductPerformanceDTO> getTopSellingProducts(UUID restaurantId, UUID branchId, LocalDate startDate, LocalDate endDate) {
        if (startDate == null) startDate = LocalDate.now().minusDays(30);
        if (endDate == null) endDate = LocalDate.now();

        String sql = """
            SELECT 
                p.id as product_id,
                p.name as product_name,
                b.name as branch_name,
                SUM(oi.quantity) as quantity_sold,
                SUM(oi.unit_price * oi.quantity) as total_revenue
            FROM order_items oi
            JOIN orders o ON oi.order_id = o.id
            JOIN products p ON oi.product_id = p.id
            JOIN branches b ON o.branch_id = b.id
            WHERE o.status = 'CLOSED'
              AND (CAST(? AS text) IS NULL OR b.restaurant_id = CAST(? AS uuid))
              AND (CAST(? AS text) IS NULL OR o.branch_id = CAST(? AS uuid))
              AND DATE(o.closed_at) BETWEEN ? AND ?
            GROUP BY p.id, p.name, b.name
            ORDER BY quantity_sold DESC, total_revenue DESC
            LIMIT 10
        """;

        String restIdStr = restaurantId != null ? restaurantId.toString() : null;
        String branchIdStr = branchId != null ? branchId.toString() : null;

        return jdbcTemplate.query(
            sql,
            (rs, rowNum) -> new ProductPerformanceDTO(
                rs.getObject("product_id", UUID.class),
                rs.getString("product_name"),
                rs.getLong("quantity_sold"),
                rs.getBigDecimal("total_revenue"),
                rs.getString("branch_name")
            ),
            restIdStr, restIdStr, branchIdStr, branchIdStr,
            Date.valueOf(startDate), Date.valueOf(endDate)
        );
    }

    public List<TurnaroundTimeDTO> getTableTurnaround(UUID restaurantId, UUID branchId, LocalDate startDate, LocalDate endDate) {
        if (startDate == null) startDate = LocalDate.now().minusDays(30);
        if (endDate == null) endDate = LocalDate.now();

        String sql = """
            SELECT 
                t.table_number,
                b.name as branch_name,
                CAST(AVG(EXTRACT(EPOCH FROM (o.closed_at - o.created_at)) / 60) AS BIGINT) as avg_minutes,
                COUNT(o.id) as total_orders
            FROM orders o
            JOIN tables t ON o.table_id = t.id
            JOIN branches b ON o.branch_id = b.id
            WHERE o.status = 'CLOSED'
              AND o.closed_at IS NOT NULL
              AND o.created_at IS NOT NULL
              AND (CAST(? AS text) IS NULL OR b.restaurant_id = CAST(? AS uuid))
              AND (CAST(? AS text) IS NULL OR o.branch_id = CAST(? AS uuid))
              AND DATE(o.closed_at) BETWEEN ? AND ?
            GROUP BY t.id, t.table_number, b.name
            ORDER BY avg_minutes DESC
            LIMIT 10
        """;

        String restIdStr = restaurantId != null ? restaurantId.toString() : null;
        String branchIdStr = branchId != null ? branchId.toString() : null;

        return jdbcTemplate.query(
            sql,
            (rs, rowNum) -> new TurnaroundTimeDTO(
                rs.getInt("table_number"),
                rs.getLong("avg_minutes"),
                rs.getLong("total_orders"),
                rs.getString("branch_name")
            ),
            restIdStr, restIdStr, branchIdStr, branchIdStr,
            Date.valueOf(startDate), Date.valueOf(endDate)
        );
    }

    public List<PeakHourDTO> getPeakHours(UUID restaurantId, UUID branchId, LocalDate startDate, LocalDate endDate) {
        if (startDate == null) startDate = LocalDate.now().minusDays(30);
        if (endDate == null) endDate = LocalDate.now();

        String sql = """
            SELECT 
                CAST(EXTRACT(HOUR FROM o.created_at) AS INTEGER) as hour_of_day,
                COUNT(o.id) as total_orders,
                SUM(o.total_amount) as total_revenue
            FROM orders o
            JOIN branches b ON o.branch_id = b.id
            WHERE o.status = 'CLOSED'
              AND o.created_at IS NOT NULL
              AND (CAST(? AS text) IS NULL OR b.restaurant_id = CAST(? AS uuid))
              AND (CAST(? AS text) IS NULL OR o.branch_id = CAST(? AS uuid))
              AND DATE(o.created_at) BETWEEN ? AND ?
            GROUP BY CAST(EXTRACT(HOUR FROM o.created_at) AS INTEGER)
            ORDER BY hour_of_day ASC
        """;

        String restIdStr = restaurantId != null ? restaurantId.toString() : null;
        String branchIdStr = branchId != null ? branchId.toString() : null;

        return jdbcTemplate.query(
            sql,
            (rs, rowNum) -> new PeakHourDTO(
                rs.getInt("hour_of_day"),
                rs.getLong("total_orders"),
                rs.getBigDecimal("total_revenue")
            ),
            restIdStr, restIdStr, branchIdStr, branchIdStr,
            Date.valueOf(startDate), Date.valueOf(endDate)
        );
    }

    public List<KdsEfficiencyDTO> getKdsEfficiency(UUID restaurantId, UUID branchId, LocalDate startDate, LocalDate endDate) {
        if (startDate == null) startDate = LocalDate.now().minusDays(30);
        if (endDate == null) endDate = LocalDate.now();

        String sql = """
            SELECT 
                p.name as product_name,
                CAST(AVG(EXTRACT(EPOCH FROM (oi.ready_at - o.created_at)) / 60) AS BIGINT) as avg_minutes,
                b.name as branch_name
            FROM order_items oi
            JOIN orders o ON oi.order_id = o.id
            JOIN products p ON oi.product_id = p.id
            JOIN branches b ON o.branch_id = b.id
            WHERE oi.ready_at IS NOT NULL
              AND o.created_at IS NOT NULL
              AND (CAST(? AS text) IS NULL OR b.restaurant_id = CAST(? AS uuid))
              AND (CAST(? AS text) IS NULL OR o.branch_id = CAST(? AS uuid))
              AND DATE(o.created_at) BETWEEN ? AND ?
            GROUP BY p.name, b.name
            ORDER BY avg_minutes DESC
            LIMIT 10
        """;

        String restIdStr = restaurantId != null ? restaurantId.toString() : null;
        String branchIdStr = branchId != null ? branchId.toString() : null;

        return jdbcTemplate.query(
            sql,
            (rs, rowNum) -> new KdsEfficiencyDTO(
                rs.getString("product_name"),
                rs.getLong("avg_minutes"),
                rs.getString("branch_name")
            ),
            restIdStr, restIdStr, branchIdStr, branchIdStr,
            Date.valueOf(startDate), Date.valueOf(endDate)
        );
    }

    public void refreshDailySalesView() {
        log.info("Refrescando vista materializada mv_daily_sales...");
        jdbcTemplate.execute("REFRESH MATERIALIZED VIEW CONCURRENTLY mv_daily_sales");
        log.info("Vista materializada mv_daily_sales refrescada exitosamente.");
    }
}
