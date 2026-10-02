package com.omnirest.omnirest_backend.repositories;

import com.omnirest.omnirest_backend.domain.entities.PedidoRappi;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface PedidoRappiRepository extends JpaRepository<PedidoRappi, UUID> {
    Optional<PedidoRappi> findByRappiOrderId(String rappiOrderId);

    boolean existsByRappiOrderId(String rappiOrderId);
}
