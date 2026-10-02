package com.omnirest.omnirest_backend.repositories;

import com.omnirest.omnirest_backend.domain.entities.MovimientoCaja;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface MovimientoCajaRepository extends JpaRepository<MovimientoCaja, UUID> {
    List<MovimientoCaja> findByTurnoIdOrderByCreadoEnAsc(UUID turnoId);
}
