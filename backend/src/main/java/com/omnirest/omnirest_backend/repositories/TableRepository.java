package com.omnirest.omnirest_backend.repositories;

import com.omnirest.omnirest_backend.domain.entities.Table;
import com.omnirest.omnirest_backend.domain.enums.TableStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface TableRepository extends JpaRepository<Table, UUID> {
    List<Table> findByBranchId(UUID branchId);

    List<Table> findByBranchRestaurantId(UUID restaurantId);

    List<Table> findByBranchIdAndStatus(UUID branchId, TableStatus status);

    Optional<Table> findByBranchIdAndTableNumber(UUID branchId, Integer tableNumber);

    Optional<Table> findByIdAndBranchId(UUID id, UUID branchId);

    Optional<Table> findByQrToken(String qrToken);
}
