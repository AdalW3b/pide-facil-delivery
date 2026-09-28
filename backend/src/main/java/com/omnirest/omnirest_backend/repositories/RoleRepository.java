package com.omnirest.omnirest_backend.repositories;

import com.omnirest.omnirest_backend.domain.entities.Role;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface RoleRepository extends JpaRepository<Role, UUID> {
    Optional<Role> findByName(String name);

    @Query("SELECT r FROM Role r WHERE (r.isCustom = false AND r.restaurant IS NULL) OR r.restaurant.id = :restaurantId")
    List<Role> findByRestaurantIdOrGlobal(@Param("restaurantId") UUID restaurantId);
}
