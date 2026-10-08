package com.omnirest.omnirest_backend.repositories;

import com.omnirest.omnirest_backend.domain.entities.Gasto;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Repository
public interface GastoRepository extends JpaRepository<Gasto, UUID> {
    /** Los gastos de un periodo [desde, hasta), los mas recientes arriba. */
    List<Gasto> findByBranchIdAndFechaGreaterThanEqualAndFechaLessThanOrderByFechaDescCreadoEnDesc(
            UUID branchId, LocalDate desde, LocalDate hasta);

    /** Si un gasto fijo ya se pago en un mes. */
    boolean existsByGastoFijoIdAndAnuladoEnIsNullAndFechaGreaterThanEqualAndFechaLessThan(
            UUID gastoFijoId, LocalDate desde, LocalDate hasta);
}
