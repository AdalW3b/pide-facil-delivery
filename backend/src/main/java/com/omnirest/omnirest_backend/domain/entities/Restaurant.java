package com.omnirest.omnirest_backend.domain.entities;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Entity
@jakarta.persistence.Table(name = "restaurants")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Restaurant {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, length = 100)
    private String name;

    @Builder.Default
    private Boolean active = true;

    @Column(name = "created_at", insertable = false, updatable = false)
    private LocalDateTime createdAt;

    @OneToMany(mappedBy = "restaurant", fetch = FetchType.LAZY, cascade = CascadeType.ALL)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private List<Branch> branches;

    @OneToMany(mappedBy = "restaurant", fetch = FetchType.LAZY, cascade = CascadeType.ALL)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private List<User> users;

    @OneToMany(mappedBy = "restaurant", fetch = FetchType.LAZY, cascade = CascadeType.ALL)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private List<Category> categories;

    
    @Column(name = "stripe_customer_id")
    private String stripeCustomerId;

    @Column(name = "stripe_subscription_id")
    private String stripeSubscriptionId;

    @Column(name = "subscription_status")
    @Builder.Default
    private String subscriptionStatus = "ACTIVE";

    @Column(name = "subscription_plan")
    private String subscriptionPlan;

    @Column(name = "trial_ends_at")
    private LocalDateTime trialEndsAt;

    @Column(name = "is_demo")
    @Builder.Default
    private Boolean isDemo = false;
}
