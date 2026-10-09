package com.omnirest.omnirest_backend.repositories;

import com.omnirest.omnirest_backend.domain.entities.AreaPreparacion;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface AreaPreparacionRepository extends JpaRepository<AreaPreparacion, UUID> {
    List<AreaPreparacion> findByRestaurantIdOrderByOrdenAscNombreAsc(UUID restaurantId);

    boolean existsByRestaurantIdAndNombreIgnoreCase(UUID restaurantId, String nombre);
}
