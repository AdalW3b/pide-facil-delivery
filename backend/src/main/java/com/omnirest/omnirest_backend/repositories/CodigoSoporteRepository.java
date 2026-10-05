package com.omnirest.omnirest_backend.repositories;

import com.omnirest.omnirest_backend.domain.entities.CodigoSoporte;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Repository
public interface CodigoSoporteRepository extends JpaRepository<CodigoSoporte, UUID> {
    /** Los codigos de este restaurante que todavia sirven. */
    List<CodigoSoporte> findByRestaurantIdAndUsadoEnIsNullAndExpiraEnAfter(UUID restaurantId, LocalDateTime ahora);
}
