package com.omnirest.omnirest_backend.repositories;

import com.omnirest.omnirest_backend.domain.entities.Kiosko;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface KioskoRepository extends JpaRepository<Kiosko, UUID> {
    Optional<Kiosko> findByTokenHash(String tokenHash);

    List<Kiosko> findByBranchIdAndActivoTrueOrderByCreadoEnAsc(UUID branchId);

    Optional<Kiosko> findByIdAndBranchId(UUID id, UUID branchId);
}
