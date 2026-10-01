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

    /** [ingredientId, productId, tipo, suma de cantidad] en un periodo: base del reporte. */
    @org.springframework.data.jpa.repository.Query(
            "SELECT m.ingredientId, m.productId, m.tipo, sum(m.cantidad) FROM MovimientoInventario m "
            + "WHERE m.branchId = :branchId AND m.creadoEn >= :desde AND m.creadoEn < :hasta "
            + "GROUP BY m.ingredientId, m.productId, m.tipo")
    List<Object[]> sumasPorTipo(@org.springframework.data.repository.query.Param("branchId") UUID branchId,
                                @org.springframework.data.repository.query.Param("desde") java.time.LocalDateTime desde,
                                @org.springframework.data.repository.query.Param("hasta") java.time.LocalDateTime hasta);
}
