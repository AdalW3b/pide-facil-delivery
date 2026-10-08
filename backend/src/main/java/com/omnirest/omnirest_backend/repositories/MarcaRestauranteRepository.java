package com.omnirest.omnirest_backend.repositories;

import com.omnirest.omnirest_backend.domain.entities.MarcaRestaurante;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface MarcaRestauranteRepository extends JpaRepository<MarcaRestaurante, UUID> {

    /** La marca sin el logo: se lee en cada pantalla y el logo va por su propia URL. */
    interface Datos {
        String getNombre();
        String getColor();
        LocalDateTime getLogoVersion();
    }

    @Query(value = "SELECT nombre, color, logo_version AS logoVersion FROM marca_restaurante "
            + "WHERE restaurant_id = :id", nativeQuery = true)
    Optional<Datos> datos(@Param("id") UUID restaurantId);

    @Query(value = "SELECT logo FROM marca_restaurante WHERE restaurant_id = :id AND logo IS NOT NULL",
            nativeQuery = true)
    Optional<byte[]> logo(@Param("id") UUID restaurantId);
}
