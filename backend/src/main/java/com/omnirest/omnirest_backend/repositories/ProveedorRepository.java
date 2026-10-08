package com.omnirest.omnirest_backend.repositories;

import com.omnirest.omnirest_backend.domain.entities.Proveedor;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface ProveedorRepository extends JpaRepository<Proveedor, UUID> {
    List<Proveedor> findByRestaurantIdOrderByNombreAsc(UUID restaurantId);

    boolean existsByRestaurantIdAndNombreIgnoreCase(UUID restaurantId, String nombre);
}
