package com.omnirest.omnirest_backend.repositories;

import com.omnirest.omnirest_backend.domain.entities.BranchIngredientStock;
import com.omnirest.omnirest_backend.domain.entities.BranchIngredientStockKey;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface BranchIngredientStockRepository extends JpaRepository<BranchIngredientStock, BranchIngredientStockKey> {
    Optional<BranchIngredientStock> findByBranchIdAndIngredientId(UUID branchId, UUID ingredientId);

    @Modifying
    @Transactional
    @Query("UPDATE BranchIngredientStock b SET b.stock = b.stock - :quantity WHERE b.ingredient.id = :ingredientId AND b.branch.id = :branchId AND b.stock >= :quantity")
    int subtractStockAtomic(@Param("branchId") UUID branchId, @Param("ingredientId") UUID ingredientId, @Param("quantity") BigDecimal quantity);

    @Modifying
    @Transactional
    @Query("UPDATE BranchIngredientStock b SET b.stock = b.stock + :quantity WHERE b.ingredient.id = :ingredientId AND b.branch.id = :branchId")
    int addStockAtomic(@Param("branchId") UUID branchId, @Param("ingredientId") UUID ingredientId, @Param("quantity") BigDecimal quantity);
}

