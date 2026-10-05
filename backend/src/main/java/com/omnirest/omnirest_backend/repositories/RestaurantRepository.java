package com.omnirest.omnirest_backend.repositories;

import com.omnirest.omnirest_backend.domain.entities.Restaurant;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface RestaurantRepository extends JpaRepository<Restaurant, UUID> {
    Optional<Restaurant> findByIdAndActiveTrue(UUID id);

    /** El restaurante de un cliente de Stripe: asi se ubica cada factura que llega por webhook. */
    Optional<Restaurant> findFirstByStripeCustomerId(String stripeCustomerId);

    @org.springframework.data.jpa.repository.Modifying
    @org.springframework.transaction.annotation.Transactional
    @org.springframework.data.jpa.repository.Query(value = "UPDATE restaurants SET menu_pdf = :pdfData WHERE id = :id", nativeQuery = true)
    void updateMenuPdf(@org.springframework.data.repository.query.Param("id") UUID id,
            @org.springframework.data.repository.query.Param("pdfData") byte[] pdfData);

    @org.springframework.data.jpa.repository.Query(value = "SELECT menu_pdf FROM restaurants WHERE id = :id", nativeQuery = true)
    byte[] getMenuPdf(@org.springframework.data.repository.query.Param("id") UUID id);

    @org.springframework.data.jpa.repository.Query(value = "SELECT CASE WHEN menu_pdf IS NOT NULL THEN true ELSE false END FROM restaurants WHERE id = :id", nativeQuery = true)
    boolean hasMenuPdf(@org.springframework.data.repository.query.Param("id") UUID id);
}
