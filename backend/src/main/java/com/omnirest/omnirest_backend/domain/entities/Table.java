package com.omnirest.omnirest_backend.domain.entities;

import com.omnirest.omnirest_backend.domain.enums.TableStatus;
import jakarta.persistence.*;
import lombok.*;
import java.util.List;
import java.util.UUID;

@Entity
@jakarta.persistence.Table(name = "tables")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Table {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "qr_token", unique = true)
    private String qrToken;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "branch_id", nullable = false)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private Branch branch;

    @Column(name = "table_number", nullable = false)
    private Integer tableNumber;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    private TableStatus status = TableStatus.AVAILABLE;

    @OneToMany(mappedBy = "table", fetch = FetchType.LAZY)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private List<Order> orders;

    @ManyToMany(mappedBy = "tables", fetch = FetchType.LAZY)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private List<User> assignedUsers;
}
