package com.omnirest.omnirest_backend.repositories;

import com.omnirest.omnirest_backend.domain.entities.CorteRepartidor;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface CorteRepartidorRepository extends JpaRepository<CorteRepartidor, UUID> {

    @EntityGraph(attributePaths = "driver")
    List<CorteRepartidor> findTop50ByBranchIdOrderByCreadoEnDesc(UUID branchId);
}
