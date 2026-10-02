package com.omnirest.omnirest_backend.repositories;

import com.omnirest.omnirest_backend.domain.entities.TurnoCaja;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface TurnoCajaRepository extends JpaRepository<TurnoCaja, UUID> {
    Optional<TurnoCaja> findByBranchIdAndCerradoEnIsNull(UUID branchId);

    List<TurnoCaja> findTop30ByBranchIdAndCerradoEnIsNotNullOrderByCerradoEnDesc(UUID branchId);

    Optional<TurnoCaja> findByIdAndBranchId(UUID id, UUID branchId);
}
