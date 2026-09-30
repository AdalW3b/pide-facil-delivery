package com.omnirest.omnirest_backend.repositories;

import com.omnirest.omnirest_backend.domain.entities.RecipeItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface RecipeItemRepository extends JpaRepository<RecipeItem, UUID> {
    List<RecipeItem> findByProductId(UUID productId);
    void deleteByProductId(UUID productId);

    /** Cuántos renglones de receta usan el ingrediente. */
    long countByIngredientId(UUID ingredientId);

    /** [ingredientId, platillos que lo usan] de un restaurante, en una consulta. */
    @org.springframework.data.jpa.repository.Query(
            "SELECT r.ingredient.id, count(DISTINCT r.product.id) FROM RecipeItem r "
            + "WHERE r.ingredient.restaurant.id = :restaurantId GROUP BY r.ingredient.id")
    java.util.List<Object[]> usosPorIngrediente(@org.springframework.data.repository.query.Param("restaurantId") UUID restaurantId);
}
