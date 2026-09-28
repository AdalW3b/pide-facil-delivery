package com.omnirest.omnirest_backend.dtos;

public record SubscriptionInfoDTO(
    String planTier,
    String billingCycle,
    String status,
    String trialEndsAt,
    String currentPeriodEnd,
    boolean cancelAtPeriodEnd,
    String stripeCustomerId,
    boolean hasPaymentMethod
) {}
