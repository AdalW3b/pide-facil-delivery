package com.omnirest.omnirest_backend.repositories;

import com.omnirest.omnirest_backend.domain.entities.BranchProductStock;
import com.omnirest.omnirest_backend.domain.entities.BranchProductStockKey;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface BranchProductStockRepository extends JpaRepository<BranchProductStock, BranchProductStockKey> {
    Optional<BranchProductStock> findByBranchIdAndProductId(UUID branchId, UUID productId);

    java.util.List<BranchProductStock> findByBranchId(UUID branchId);

    /** La existencia tal como esta en la base, sin pasar por la cache de la sesion. */
    @Query("SELECT b.stock FROM BranchProductStock b WHERE b.branch.id = :branchId AND b.product.id = :productId")
    Optional<Integer> saldo(@Param("branchId") UUID branchId, @Param("productId") UUID productId);

    @Query("SELECT b.costoPromedio FROM BranchProductStock b WHERE b.branch.id = :branchId AND b.product.id = :productId")
    Optional<java.math.BigDecimal> costo(@Param("branchId") UUID branchId, @Param("productId") UUID productId);

    @Query("SELECT b.minimo FROM BranchProductStock b WHERE b.branch.id = :branchId AND b.product.id = :productId")
    Optional<Integer> minimo(@Param("branchId") UUID branchId, @Param("productId") UUID productId);

    @Modifying
    @Transactional
    @Query("UPDATE BranchProductStock b SET b.minimo = :minimo WHERE b.product.id = :productId AND b.branch.id = :branchId")
    int fijarMinimo(@Param("branchId") UUID branchId, @Param("productId") UUID productId, @Param("minimo") Integer minimo);

    @Query("SELECT COALESCE(SUM(b.stock), 0) FROM BranchProductStock b WHERE b.product.id = :productId")
    Long totalEnSucursales(@Param("productId") UUID productId);

    @Modifying
    @Transactional
    @Query("UPDATE BranchProductStock b SET b.costoPromedio = :costo WHERE b.product.id = :productId AND b.branch.id = :branchId")
    int fijarCosto(@Param("branchId") UUID branchId, @Param("productId") UUID productId, @Param("costo") java.math.BigDecimal costo);

    @Modifying
    @Transactional
    @Query("UPDATE BranchProductStock b SET b.stock = b.stock - :quantity WHERE b.product.id = :productId AND b.branch.id = :branchId AND b.stock >= :quantity")
    int subtractStockAtomic(@Param("branchId") UUID branchId, @Param("productId") UUID productId, @Param("quantity") Integer quantity);

    @Modifying
    @Transactional
    @Query("UPDATE BranchProductStock b SET b.stock = b.stock + :quantity WHERE b.product.id = :productId AND b.branch.id = :branchId")
    int addStockAtomic(@Param("branchId") UUID branchId, @Param("productId") UUID productId, @Param("quantity") Integer quantity);
}
