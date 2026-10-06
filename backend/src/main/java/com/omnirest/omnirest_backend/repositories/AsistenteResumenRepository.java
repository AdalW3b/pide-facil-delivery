package com.omnirest.omnirest_backend.repositories;

import com.omnirest.omnirest_backend.domain.entities.AsistenteResumen;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Repository
public interface AsistenteResumenRepository extends JpaRepository<AsistenteResumen, UUID> {
    boolean existsByBranchIdAndDia(UUID branchId, LocalDate dia);

    List<AsistenteResumen> findTop14ByBranchIdOrderByDiaDesc(UUID branchId);
}
