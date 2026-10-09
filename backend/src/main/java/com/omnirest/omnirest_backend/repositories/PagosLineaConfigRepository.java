package com.omnirest.omnirest_backend.repositories;

import com.omnirest.omnirest_backend.domain.entities.PagosLineaConfig;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface PagosLineaConfigRepository extends JpaRepository<PagosLineaConfig, UUID> {

    Optional<PagosLineaConfig> findByStripeAccountId(String stripeAccountId);
}
