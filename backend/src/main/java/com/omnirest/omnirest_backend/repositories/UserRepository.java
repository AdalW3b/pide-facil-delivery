package com.omnirest.omnirest_backend.repositories;

import com.omnirest.omnirest_backend.domain.entities.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface UserRepository extends JpaRepository<User, UUID> {
    Optional<User> findByUsername(String username);

    Optional<User> findByUsernameAndActiveTrue(String username);

    List<User> findByRestaurantId(UUID restaurantId);

    long countByRestaurantId(UUID restaurantId);

    List<User> findByBranchId(UUID branchId);

    Optional<User> findByIdAndRestaurantId(UUID id, UUID restaurantId);

    Optional<User> findByIdAndBranchId(UUID id, UUID branchId);

    @Query("SELECT u FROM User u JOIN FETCH u.restaurant WHERE u.role.name = 'SUPER_ADMIN' ORDER BY u.createdAt DESC")
    List<User> findAllRestaurantOwners();
}
