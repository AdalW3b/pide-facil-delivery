package com.omnirest.omnirest_backend.repositories;

import com.omnirest.omnirest_backend.domain.entities.GastoFijo;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface GastoFijoRepository extends JpaRepository<GastoFijo, UUID> {
    List<GastoFijo> findByBranchIdOrderByDiaDelMesAscConceptoAsc(UUID branchId);
}
