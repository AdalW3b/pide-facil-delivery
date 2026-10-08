package com.omnirest.omnirest_backend.repositories;

import com.omnirest.omnirest_backend.domain.entities.PresentacionCompra;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface PresentacionCompraRepository extends JpaRepository<PresentacionCompra, UUID> {

    /** Las presentaciones de todos los articulos del restaurante. */
    @Query(value = "SELECT pc.* FROM presentaciones_compra pc "
            + "LEFT JOIN ingredients i ON i.id = pc.ingredient_id "
            + "LEFT JOIN products p ON p.id = pc.product_id "
            + "LEFT JOIN categories c ON c.id = p.category_id "
            + "WHERE i.restaurant_id = :restaurantId OR c.restaurant_id = :restaurantId "
            + "ORDER BY pc.nombre", nativeQuery = true)
    List<PresentacionCompra> delRestaurante(@Param("restaurantId") UUID restaurantId);
}
