package com.omnirest.omnirest_backend.repositories;

import com.omnirest.omnirest_backend.domain.entities.AsistenteConfig;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface AsistenteConfigRepository extends JpaRepository<AsistenteConfig, UUID> {
    /** Los que pidieron el resumen diario y tienen el complemento activo. */
    List<AsistenteConfig> findByComplementoActivoTrueAndResumenDiarioTrue();
}
