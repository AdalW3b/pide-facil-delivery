package com.omnirest.omnirest_backend.repositories;

import com.omnirest.omnirest_backend.domain.entities.ZonaInventario;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface ZonaInventarioRepository extends JpaRepository<ZonaInventario, UUID> {
    List<ZonaInventario> findByRestaurantIdOrderByOrdenAscNombreAsc(UUID restaurantId);

    boolean existsByRestaurantIdAndNombreIgnoreCase(UUID restaurantId, String nombre);

    /** Cuantos ingredientes y productos tiene la zona. */
    @Query("SELECT (SELECT count(i) FROM Ingredient i WHERE i.zona.id = :id) "
            + "+ (SELECT count(p) FROM Product p WHERE p.zona.id = :id) FROM ZonaInventario z WHERE z.id = :id")
    Long articulosEn(@Param("id") UUID id);
}
