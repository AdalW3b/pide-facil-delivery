package com.omnirest.omnirest_backend.domain.entities;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Entity
@jakarta.persistence.Table(name = "branches")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Branch {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "restaurant_id", nullable = false)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private Restaurant restaurant;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(columnDefinition = "TEXT")
    private String address;

    @Column(name = "whatsapp_number", unique = true, length = 20)
    private String whatsappNumber;

    @Column(name = "n8n_webhook_url")
    private String n8nWebhookUrl;

    @Column(name = "webhook_secret")
    private String webhookSecret;

    @Builder.Default
    private Boolean active = true;

    @Column(name = "created_at", insertable = false, updatable = false)
    private LocalDateTime createdAt;

    @OneToMany(mappedBy = "branch", fetch = FetchType.LAZY, cascade = CascadeType.ALL)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private List<User> users;

    @OneToMany(mappedBy = "branch", fetch = FetchType.LAZY, cascade = CascadeType.ALL)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private List<Table> tables;

    @OneToMany(mappedBy = "branch", fetch = FetchType.LAZY, cascade = CascadeType.ALL)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private List<Order> orders;

    @Column(name = "bot_name", length = 100)
    private String botName;

    @Column(name = "bot_tone", length = 600)
    private String botTone;

    /** Que pasa cuando una venta necesita mas de lo que hay. Ver ControlInventario. */
    @Enumerated(EnumType.STRING)
    @Column(name = "control_inventario", nullable = false, length = 10)
    @Builder.Default
    private com.omnirest.omnirest_backend.domain.enums.ControlInventario controlInventario =
            com.omnirest.omnirest_backend.domain.enums.ControlInventario.AVISAR;
}
