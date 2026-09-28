package com.omnirest.omnirest_backend.repositories;

import com.omnirest.omnirest_backend.domain.entities.Customer;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface CustomerRepository extends JpaRepository<Customer, UUID> {
    Optional<Customer> findByRestaurantIdAndPhoneNumber(UUID restaurantId, String phoneNumber);
    List<Customer> findByPhoneNumber(String phoneNumber);
}
