package com.omnirest.omnirest_backend.repositories;

import com.omnirest.omnirest_backend.domain.entities.PaymentMethod;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.UUID;

public interface PaymentMethodRepository extends JpaRepository<PaymentMethod, UUID> {
    List<PaymentMethod> findByBranchId(UUID branchId);
}
