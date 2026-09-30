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
}
