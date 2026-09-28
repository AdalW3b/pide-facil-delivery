package com.omnirest.omnirest_backend.domain.entities;

import jakarta.persistence.*;
import lombok.*;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.UUID;

@Entity
@jakarta.persistence.Table(name = "users")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class User implements UserDetails {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "restaurant_id", nullable = false)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private Restaurant restaurant;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "branch_id")
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private Branch branch;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "role_id", nullable = false)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private Role role;

    @Column(nullable = false, unique = true, length = 50)
    private String username;

    @Column(length = 100)
    private String name;

    @Column(name = "phone_number", length = 20)
    private String phoneNumber;

    @Column(name = "password_hash", nullable = false, length = 255)
    private String passwordHash;

    @Builder.Default
    private Boolean active = true;

    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(name = "user_tables", joinColumns = @JoinColumn(name = "user_id"), inverseJoinColumns = @JoinColumn(name = "table_id"))
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private List<Table> tables;

    @Column(name = "created_at", insertable = false, updatable = false)
    private LocalDateTime createdAt;

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        List<SimpleGrantedAuthority> authorities = new java.util.ArrayList<>();

        if (role != null) {
            // 1. Inyectar el rol crudo para que pasen los filtros de AnalyticsController
            if (role.getName() != null) {
                authorities.add(new SimpleGrantedAuthority(role.getName()));
            }

            // 2. Inyectar los permisos granulares para el resto de los controladores
            if (role.getPermissions() != null) {
                role.getPermissions().forEach(p -> authorities.add(new SimpleGrantedAuthority(p.getName())));
            }
        }

        return authorities;
    }

    @Override
    public String getPassword() {
        return this.passwordHash;
    }

    @Override
    public String getUsername() {
        return this.username;
    }

    @Override
    public boolean isAccountNonExpired() {
        return true;
    }

    @Override
    public boolean isAccountNonLocked() {
        return true;
    }

    @Override
    public boolean isCredentialsNonExpired() {
        return true;
    }

    @Override
    public boolean isEnabled() {
        return this.active;
    }
}