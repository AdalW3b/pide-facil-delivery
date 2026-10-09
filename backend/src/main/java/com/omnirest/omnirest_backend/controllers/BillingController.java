package com.omnirest.omnirest_backend.controllers;

import com.omnirest.omnirest_backend.dtos.CheckoutSessionRequestDTO;
import com.omnirest.omnirest_backend.dtos.CheckoutSessionResponseDTO;
import com.omnirest.omnirest_backend.dtos.CustomerPortalResponseDTO;
import com.omnirest.omnirest_backend.dtos.SubscriptionInfoDTO;
import com.omnirest.omnirest_backend.security.CustomUserDetails;
import com.omnirest.omnirest_backend.services.StripeBillingService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/billing")
@RequiredArgsConstructor
@Slf4j
public class BillingController {

    private final StripeBillingService stripeBillingService;

    @PostMapping("/checkout-session")
    public ResponseEntity<CheckoutSessionResponseDTO> createCheckoutSession(
            @RequestBody CheckoutSessionRequestDTO request,
            @AuthenticationPrincipal CustomUserDetails userDetails
    ) {
        UUID authenticatedRestaurantId = userDetails != null ? userDetails.restaurantId() : null;
        CheckoutSessionResponseDTO response = stripeBillingService.createCheckoutSession(request, authenticatedRestaurantId);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/customer-portal")
    public ResponseEntity<CustomerPortalResponseDTO> createCustomerPortal(
            @AuthenticationPrincipal CustomUserDetails userDetails
    ) {
        UUID restaurantId = userDetails != null ? userDetails.restaurantId() : null;
        CustomerPortalResponseDTO response = stripeBillingService.createCustomerPortalSession(restaurantId);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/subscription")
    public ResponseEntity<SubscriptionInfoDTO> getSubscription(
            @RequestParam(required = false) UUID restaurantId,
            @AuthenticationPrincipal CustomUserDetails userDetails
    ) {
        UUID targetId = restaurantId != null ? restaurantId : (userDetails != null ? userDetails.restaurantId() : null);
        SubscriptionInfoDTO response = stripeBillingService.getSubscriptionInfo(targetId);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/webhook")
    public ResponseEntity<String> handleWebhook(
            @RequestBody String payload,
            @RequestHeader(value = "Stripe-Signature", required = false) String sigHeader
    ) {
        try {
            stripeBillingService.processWebhook(payload, sigHeader);
            return ResponseEntity.ok("Webhook processed");
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        } catch (IllegalStateException e) {
            // Sin secreto no se procesa nada; Stripe reintenta cuando se configure.
            return ResponseEntity.status(org.springframework.http.HttpStatus.SERVICE_UNAVAILABLE).body(e.getMessage());
        } catch (Exception e) {
            log.error("[BillingController] Error procesando webhook: {}", e.getMessage());
            return ResponseEntity.internalServerError().body("Error interno");
        }
    }
}
