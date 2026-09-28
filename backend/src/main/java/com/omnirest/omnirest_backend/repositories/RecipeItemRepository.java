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
}
