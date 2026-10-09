package com.omnirest.omnirest_backend.repositories;

import com.omnirest.omnirest_backend.domain.entities.ReembolsoLinea;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ReembolsoLineaRepository extends JpaRepository<ReembolsoLinea, UUID> {

    Optional<ReembolsoLinea> findByStripeRefundId(String stripeRefundId);

    List<ReembolsoLinea> findByTransaccionIdOrderByCreadoEnAsc(UUID transaccionId);
}
