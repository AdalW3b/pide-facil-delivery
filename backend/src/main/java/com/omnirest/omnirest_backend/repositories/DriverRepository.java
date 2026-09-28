package com.omnirest.omnirest_backend.repositories;

import com.omnirest.omnirest_backend.domain.entities.Driver;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface DriverRepository extends JpaRepository<Driver, UUID> {

    Optional<Driver> findByRestaurantIdAndPhoneNumber(UUID restaurantId, String phoneNumber);

    List<Driver> findByRestaurantIdOrderByNombreAsc(UUID restaurantId);
}
