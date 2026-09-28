package com.omnirest.omnirest_backend.repositories;

import com.omnirest.omnirest_backend.domain.entities.Branch;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface BranchRepository extends JpaRepository<Branch, UUID> {
    @EntityGraph(attributePaths = {"restaurant"})
    List<Branch> findByRestaurantId(UUID restaurantId);
    List<Branch> findByRestaurantIdAndActiveTrue(UUID restaurantId);
    Optional<Branch> findByIdAndRestaurantId(UUID id, UUID restaurantId);
    long countByRestaurantId(UUID restaurantId);

    /** El numero de WhatsApp es unico: identifica a la sucursal ante el bot. */
    Optional<Branch> findByWhatsappNumber(String whatsappNumber);
}
