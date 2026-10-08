package com.omnirest.omnirest_backend.repositories;

import com.omnirest.omnirest_backend.domain.entities.MovimientoInventario;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface MovimientoInventarioRepository extends JpaRepository<MovimientoInventario, UUID> {
    List<MovimientoInventario> findTop100ByBranchIdAndIngredientIdOrderByCreadoEnDesc(UUID branchId, UUID ingredientId);

    List<MovimientoInventario> findTop100ByBranchIdAndProductIdOrderByCreadoEnDesc(UUID branchId, UUID productId);

    boolean existsByIngredientId(UUID ingredientId);

    List<MovimientoInventario> findByGrupoIdIn(java.util.Collection<UUID> grupos);

    /** Lo ultimo que se pago por cada articulo en compras vigentes (no anuladas). */
    interface UltimoPrecio {
        UUID getIngredientId();
        UUID getProductId();
        java.math.BigDecimal getCostoUnitario();
        java.time.LocalDateTime getCreadoEn();
        String getProveedor();
    }

    @org.springframework.data.jpa.repository.Query(value = "SELECT DISTINCT ON (COALESCE(m.ingredient_id, m.product_id)) "
            + "m.ingredient_id AS ingredientId, m.product_id AS productId, m.costo_unitario AS costoUnitario, "
            + "m.creado_en AS creadoEn, m.proveedor AS proveedor "
            + "FROM movimientos_inventario m "
            + "WHERE m.branch_id = :branchId AND m.tipo = 'ENTRADA' AND m.cantidad > 0 AND m.costo_unitario IS NOT NULL "
            + "AND (m.grupo_id IS NULL OR m.grupo_id NOT IN (SELECT c.id FROM compras c WHERE c.anulada_en IS NOT NULL)) "
            + "ORDER BY COALESCE(m.ingredient_id, m.product_id), m.creado_en DESC", nativeQuery = true)
    List<UltimoPrecio> ultimosPrecios(@org.springframework.data.repository.query.Param("branchId") UUID branchId);

    /** [ingredientId, productId, tipo, suma de cantidad] en un periodo: base del reporte. */
    @org.springframework.data.jpa.repository.Query(
            "SELECT m.ingredientId, m.productId, m.tipo, sum(m.cantidad) FROM MovimientoInventario m "
            + "WHERE m.branchId = :branchId AND m.creadoEn >= :desde AND m.creadoEn < :hasta "
            + "GROUP BY m.ingredientId, m.productId, m.tipo")
    List<Object[]> sumasPorTipo(@org.springframework.data.repository.query.Param("branchId") UUID branchId,
                                @org.springframework.data.repository.query.Param("desde") java.time.LocalDateTime desde,
                                @org.springframework.data.repository.query.Param("hasta") java.time.LocalDateTime hasta);
}
