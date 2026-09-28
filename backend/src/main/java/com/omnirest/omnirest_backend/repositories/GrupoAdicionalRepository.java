package com.omnirest.omnirest_backend.repositories;

import com.omnirest.omnirest_backend.domain.entities.GrupoAdicional;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface GrupoAdicionalRepository extends JpaRepository<GrupoAdicional, UUID> {

    @EntityGraph(attributePaths = {"categorias", "productos"})
    List<GrupoAdicional> findByRestaurantIdOrderByOrdenAscNombreAsc(UUID restaurantId);

    @EntityGraph(attributePaths = {"categorias", "productos"})
    List<GrupoAdicional> findByRestaurantIdAndActivoTrueOrderByOrdenAscNombreAsc(UUID restaurantId);
}
