package com.omnirest.omnirest_backend.repositories;

import com.omnirest.omnirest_backend.domain.entities.AvisoSistema;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Repository
public interface AvisoSistemaRepository extends JpaRepository<AvisoSistema, UUID> {
    List<AvisoSistema> findTop30ByRestaurantIdOrderByCreadoEnDesc(UUID restaurantId);

    long countByRestaurantIdAndLeidoEnIsNull(UUID restaurantId);

    @Modifying
    @Query("UPDATE AvisoSistema a SET a.leidoEn = :ahora WHERE a.restaurantId = :restaurantId AND a.leidoEn IS NULL")
    int marcarLeidos(@Param("restaurantId") UUID restaurantId, @Param("ahora") LocalDateTime ahora);
}
