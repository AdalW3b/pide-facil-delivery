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

    @Modifying
    @Transactional
    @Query("UPDATE BranchProductStock b SET b.stock = b.stock - :quantity WHERE b.product.id = :productId AND b.branch.id = :branchId AND b.stock >= :quantity")
    int subtractStockAtomic(@Param("branchId") UUID branchId, @Param("productId") UUID productId, @Param("quantity") Integer quantity);

    @Modifying
    @Transactional
    @Query("UPDATE BranchProductStock b SET b.stock = b.stock + :quantity WHERE b.product.id = :productId AND b.branch.id = :branchId")
    int addStockAtomic(@Param("branchId") UUID branchId, @Param("productId") UUID productId, @Param("quantity") Integer quantity);
}
