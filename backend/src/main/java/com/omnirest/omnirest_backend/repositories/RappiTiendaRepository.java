package com.omnirest.omnirest_backend.repositories;

import com.omnirest.omnirest_backend.domain.entities.RappiTienda;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface RappiTiendaRepository extends JpaRepository<RappiTienda, UUID> {
    Optional<RappiTienda> findByStoreId(String storeId);
}
