package com.omnirest.omnirest_backend.repositories;

import com.omnirest.omnirest_backend.domain.entities.Ingredient;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface IngredientRepository extends JpaRepository<Ingredient, UUID> {
    List<Ingredient> findByRestaurantId(UUID restaurantId);
}
