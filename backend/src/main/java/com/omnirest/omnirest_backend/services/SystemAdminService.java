package com.omnirest.omnirest_backend.services;

import com.omnirest.omnirest_backend.domain.entities.Branch;
import com.omnirest.omnirest_backend.domain.entities.Restaurant;
import com.omnirest.omnirest_backend.domain.entities.User;
import com.omnirest.omnirest_backend.dtos.TenantCreatorDTO;
import com.omnirest.omnirest_backend.repositories.BranchRepository;
import com.omnirest.omnirest_backend.repositories.RestaurantRepository;
import com.omnirest.omnirest_backend.repositories.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class SystemAdminService {

    private final UserRepository userRepository;
    private final RestaurantRepository restaurantRepository;
    private final BranchRepository branchRepository;
    private final DemoSeederService demoSeederService;

    public List<TenantCreatorDTO> getAllRestaurantOwners() {
        return userRepository.findAllRestaurantOwners().stream()
                .map(this::mapToDto)
                .collect(Collectors.toList());
    }

    @Transactional
    public TenantCreatorDTO toggleCreatorStatus(UUID userId) {
        User owner = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("Usuario creador no encontrado."));

        if ("SYSTEM_ADMIN".equalsIgnoreCase(owner.getRole().getName())) {
            throw new IllegalStateException("No se puede alterar el estado del administrador del sistema.");
        }

        boolean newStatus = !Boolean.TRUE.equals(owner.getActive());
        owner.setActive(newStatus);

        Restaurant restaurant = owner.getRestaurant();
        if (restaurant != null) {
            restaurant.setActive(newStatus);
            restaurantRepository.save(restaurant);

            // 1. Desactivar/Activar todas las sucursales
            List<Branch> branches = branchRepository.findByRestaurantId(restaurant.getId());
            branches.forEach(b -> b.setActive(newStatus));
            branchRepository.saveAll(branches);

            // 2. Desactivar/Activar todos los usuarios de la empresa
            List<User> users = userRepository.findByRestaurantId(restaurant.getId());
            users.forEach(u -> u.setActive(newStatus));
            userRepository.saveAll(users);
        } else {
            userRepository.save(owner);
        }

        return mapToDto(owner);
    }

    @Transactional
    public TenantCreatorDTO toggleDemoMode(UUID restaurantId) {
        Restaurant restaurant = restaurantRepository.findById(restaurantId)
                .orElseThrow(() -> new IllegalArgumentException("Restaurante no encontrado: " + restaurantId));

        User owner = userRepository.findByRestaurantId(restaurantId).stream()
                .filter(u -> "SUPER_ADMIN".equalsIgnoreCase(u.getRole().getName()))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("No se encontró el propietario del restaurante."));

        if ("demo".equalsIgnoreCase(owner.getUsername())) {
            throw new IllegalStateException("La cuenta 'demo' (Taquería El Farolito) es exclusiva para demostración y no puede pasar a Pro.");
        }

        boolean nextDemoState = !Boolean.TRUE.equals(restaurant.getIsDemo());
        restaurant.setIsDemo(nextDemoState);
        restaurantRepository.save(restaurant);

        return mapToDto(owner);
    }

    private TenantCreatorDTO mapToDto(User user) {
        return new TenantCreatorDTO(
                user.getId(),
                user.getName(),
                user.getUsername(),
                user.getPhoneNumber(),
                user.getActive(),
                user.getRestaurant() != null ? user.getRestaurant().getId() : null,
                user.getRestaurant() != null ? user.getRestaurant().getName() : "Sin Restaurante",
                user.getRestaurant() != null && Boolean.TRUE.equals(user.getRestaurant().getIsDemo()),
                user.getCreatedAt(),
                user.getRestaurant() != null ? user.getRestaurant().getSubscriptionPlan() : null,
                user.getRestaurant() != null ? user.getRestaurant().getSubscriptionStatus() : null,
                user.getRestaurant() != null ? user.getRestaurant().getTrialEndsAt() : null);
    }
}