package com.omnirest.omnirest_backend.repositories;

import com.omnirest.omnirest_backend.domain.entities.ComboItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface ComboItemRepository extends JpaRepository<ComboItem, UUID> {
    /** Los combos en que va un platillo. */
    List<ComboItem> findByProductoId(UUID productId);
}
