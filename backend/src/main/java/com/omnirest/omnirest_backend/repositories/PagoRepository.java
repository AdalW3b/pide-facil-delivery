package com.omnirest.omnirest_backend.repositories;

import com.omnirest.omnirest_backend.domain.entities.Pago;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

@Repository
public interface PagoRepository extends JpaRepository<Pago, UUID> {
    List<Pago> findByTurnoIdOrderByCreadoEnAsc(UUID turnoId);

    List<Pago> findByOrderId(UUID orderId);

    long countByTurnoId(UUID turnoId);

    /** Lo abonado a la cuenta, sin propinas. */
    @Query("SELECT coalesce(sum(p.monto), 0) FROM Pago p WHERE p.orderId = :orderId")
    BigDecimal pagadoDe(@Param("orderId") UUID orderId);

    /** Cuantas cuentas distintas se cobraron en el turno. */
    @Query("SELECT count(DISTINCT p.orderId) FROM Pago p WHERE p.turnoId = :turnoId")
    long cuentasCobradas(@Param("turnoId") UUID turnoId);
}
