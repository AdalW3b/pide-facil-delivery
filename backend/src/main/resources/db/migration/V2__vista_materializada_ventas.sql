-- ============================================================================
--  Vista materializada de ventas diarias
--
--  La entidad DailySalesView la mapea con @Immutable sobre la tabla
--  mv_daily_sales. La agregación reproduce exactamente la del método
--  AnalyticsService.queryDirectOrdersDailySales(), que es el camino de
--  respaldo cuando la vista no está disponible: si las dos no coinciden,
--  la analítica devuelve cifras distintas según el camino que tome.
--
--  EL ÍNDICE ÚNICO NO ES OPCIONAL. AnalyticsService.refreshDailySalesView()
--  ejecuta REFRESH MATERIALIZED VIEW CONCURRENTLY, y PostgreSQL rechaza esa
--  variante si la vista no tiene al menos un índice único. Sin él, la tarea
--  programada de AnalyticsScheduler falla cada 30 minutos.
-- ============================================================================

CREATE MATERIALIZED VIEW mv_daily_sales AS
SELECT
    b.restaurant_id                    AS restaurant_id,
    o.branch_id                        AS branch_id,
    DATE(o.closed_at)                  AS sale_date,
    COUNT(o.id)                        AS total_orders,
    COALESCE(SUM(o.total_amount), 0)   AS total_revenue
FROM orders o
JOIN branches b ON o.branch_id = b.id
WHERE o.status = 'CLOSED'
  AND o.closed_at IS NOT NULL
GROUP BY b.restaurant_id, o.branch_id, DATE(o.closed_at)
WITH DATA;

-- Obligatorio para el refresco concurrente. Coincide con la clave compuesta
-- de DailySalesId (restaurantId, branchId, saleDate).
CREATE UNIQUE INDEX ux_mv_daily_sales_pk
    ON mv_daily_sales (restaurant_id, branch_id, sale_date);

-- Sirve al filtro por rango de fechas de DailySalesViewRepository.findDailySales().
CREATE INDEX ix_mv_daily_sales_fecha
    ON mv_daily_sales (sale_date);

COMMENT ON MATERIALIZED VIEW mv_daily_sales IS
    'Ventas cerradas por restaurante, sucursal y día. La refresca AnalyticsScheduler '
    'cada 30 minutos (cron 0 0/30 * * * ?), así que los datos van con ese retraso.';
