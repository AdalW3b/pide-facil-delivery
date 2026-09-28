package com.omnirest.omnirest_backend.repositories;

import com.omnirest.omnirest_backend.domain.entities.Product;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ProductRepository extends JpaRepository<Product, UUID> {
    List<Product> findByCategoryId(UUID categoryId);
    List<Product> findByCategoryRestaurantId(UUID restaurantId);
    List<Product> findByCategoryRestaurantIdAndActiveTrue(UUID restaurantId);
    Optional<Product> findByIdAndCategoryRestaurantId(UUID id, UUID restaurantId);
    List<Product> findByCategoryRestaurantIdAndActiveTrueAndNameContainingIgnoreCase(UUID restaurantId, String name);
}
