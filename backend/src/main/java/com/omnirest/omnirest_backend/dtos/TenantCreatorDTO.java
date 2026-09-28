package com.omnirest.omnirest_backend.dtos;

import java.time.LocalDateTime;
import java.util.UUID;

public record TenantCreatorDTO(
                UUID userId,
                String name,
                String username,
                String phoneNumber,
                Boolean active,
                UUID restaurantId,
                String restaurantName,
                Boolean isDemo,
                LocalDateTime createdAt,
                String subscriptionPlan,
                String subscriptionStatus,
                LocalDateTime trialEndsAt) {
}
