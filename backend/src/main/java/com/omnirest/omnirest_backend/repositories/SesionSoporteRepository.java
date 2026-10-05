package com.omnirest.omnirest_backend.repositories;

import com.omnirest.omnirest_backend.domain.entities.SesionSoporte;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface SesionSoporteRepository extends JpaRepository<SesionSoporte, UUID> {
    List<SesionSoporte> findByOperadorIdAndFinIsNull(UUID operadorId);

    List<SesionSoporte> findTop50ByRestaurantIdOrderByInicioDesc(UUID restaurantId);

    List<SesionSoporte> findTop100ByOrderByInicioDesc();
}
