package com.omnirest.omnirest_backend.domain.entities;

import jakarta.persistence.*;
import lombok.*;
import java.util.UUID;

@Entity
@jakarta.persistence.Table(name = "permissions")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Permission {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, unique = true, length = 100)
    private String name;

    @Column(length = 255)
    private String description;
}
