package com.omnirest.omnirest_backend.repositories;

import com.omnirest.omnirest_backend.domain.entities.AsistenteMensaje;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.UUID;

@Repository
public interface AsistenteMensajeRepository extends JpaRepository<AsistenteMensaje, UUID> {
    long countByUserIdAndCreadoEnAfter(UUID userId, LocalDateTime desde);

    long countByRestaurantIdAndCreadoEnAfter(UUID restaurantId, LocalDateTime desde);

    /** Tokens del periodo: [entrada, salida]. */
    @Query("SELECT coalesce(sum(m.tokensEntrada), 0), coalesce(sum(m.tokensSalida), 0) FROM AsistenteMensaje m "
            + "WHERE m.restaurantId = :restaurantId AND m.creadoEn >= :desde")
    java.util.List<Object[]> tokensDesde(@Param("restaurantId") UUID restaurantId, @Param("desde") LocalDateTime desde);
}
