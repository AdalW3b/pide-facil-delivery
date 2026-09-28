package com.omnirest.omnirest_backend.repositories;

import com.omnirest.omnirest_backend.domain.entities.BranchDeliverySettings;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.UUID;

@Repository
public interface BranchDeliverySettingsRepository extends JpaRepository<BranchDeliverySettings, UUID> {
}
