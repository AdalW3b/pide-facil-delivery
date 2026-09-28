package com.omnirest.omnirest_backend.repositories;

import com.omnirest.omnirest_backend.domain.entities.FotoProducto;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface FotoProductoRepository extends JpaRepository<FotoProducto, UUID> {

    /** Que platillos tienen foto y su version, sin cargar las imagenes. */
    interface Version {
        UUID getProductId();
        LocalDateTime getActualizadoEn();
    }

    @Query(value = "SELECT f.product_id AS productId, f.actualizado_en AS actualizadoEn "
            + "FROM fotos_producto f JOIN products p ON p.id = f.product_id "
            + "JOIN categories c ON c.id = p.category_id WHERE c.restaurant_id = :restaurantId",
            nativeQuery = true)
    List<Version> versionesDelRestaurante(@Param("restaurantId") UUID restaurantId);

    @Query(value = "SELECT miniatura FROM fotos_producto WHERE product_id = :id", nativeQuery = true)
    Optional<byte[]> miniatura(@Param("id") UUID productId);

    @Query(value = "SELECT grande FROM fotos_producto WHERE product_id = :id", nativeQuery = true)
    Optional<byte[]> grande(@Param("id") UUID productId);
}
