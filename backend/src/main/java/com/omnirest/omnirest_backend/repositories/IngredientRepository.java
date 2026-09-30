package com.omnirest.omnirest_backend.repositories;

import com.omnirest.omnirest_backend.domain.entities.Ingredient;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface IngredientRepository extends JpaRepository<Ingredient, UUID> {

    /** Cuantos adicionales descuentan este ingrediente ("Carne extra" -> pastor). */
    @org.springframework.data.jpa.repository.Query(
            "SELECT count(a) FROM Adicional a WHERE a.ingrediente.id = :ingredientId")
    long adicionalesQueLoUsan(@org.springframework.data.repository.query.Param("ingredientId") UUID ingredientId);
    List<Ingredient> findByRestaurantId(UUID restaurantId);
}
