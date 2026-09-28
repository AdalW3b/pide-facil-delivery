package com.omnirest.omnirest_backend.repositories;

import com.omnirest.omnirest_backend.domain.entities.Category;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface CategoryRepository extends JpaRepository<Category, UUID> {
    List<Category> findByRestaurantId(UUID restaurantId);
    List<Category> findByRestaurantIdAndActiveTrue(UUID restaurantId);
    Optional<Category> findByIdAndRestaurantId(UUID id, UUID restaurantId);
}
