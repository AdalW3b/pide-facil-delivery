package com.omnirest.omnirest_backend.repositories;

import com.omnirest.omnirest_backend.domain.entities.CustomerAddress;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface CustomerAddressRepository extends JpaRepository<CustomerAddress, UUID> {

    List<CustomerAddress> findByCustomerIdAndActivaTrueOrderByEsPrincipalDescCreadaEnDesc(UUID customerId);

    Optional<CustomerAddress> findByIdAndCustomerId(UUID id, UUID customerId);
}
