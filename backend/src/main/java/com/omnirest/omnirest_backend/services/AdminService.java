package com.omnirest.omnirest_backend.services;

import com.omnirest.omnirest_backend.domain.entities.Branch;
import com.omnirest.omnirest_backend.domain.entities.Restaurant;
import com.omnirest.omnirest_backend.domain.entities.Role;
import com.omnirest.omnirest_backend.domain.entities.User;
import com.omnirest.omnirest_backend.dtos.*;
import com.omnirest.omnirest_backend.repositories.BranchRepository;
import com.omnirest.omnirest_backend.repositories.RestaurantRepository;
import com.omnirest.omnirest_backend.repositories.RoleRepository;
import com.omnirest.omnirest_backend.repositories.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.UUID;

import com.omnirest.omnirest_backend.security.CustomUserDetails;

@Service
@RequiredArgsConstructor
public class AdminService {

    private final RestaurantRepository restaurantRepository;
    private final BranchRepository branchRepository;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final RoleRepository roleRepository;

    // ─── Restaurants ──────────────────────────────────────────────────────────

    /**
     * Returns all active restaurants with their active branches nested.
     */
    @Transactional(readOnly = true)
    public List<RestaurantWithBranchesDTO> getAllRestaurantsWithBranches(CustomUserDetails user) {
        if ("SYSTEM_ADMIN".equalsIgnoreCase(user.roleName())) {
            return restaurantRepository.findAll().stream()
                    .map(this::mapToRestaurantWithBranches)
                    .toList();
        }
        UUID targetRestaurantId = user.restaurantId();
        boolean isDemo = targetRestaurantId != null && restaurantRepository.findById(targetRestaurantId)
                .map(r -> Boolean.TRUE.equals(r.getIsDemo()))
                .orElse(false);
        if (isDemo) {
            targetRestaurantId = restaurantRepository.findAll().stream()
                    .filter(r -> Boolean.TRUE.equals(r.getIsDemo()))
                    .map(Restaurant::getId)
                    .findFirst()
                    .orElse(targetRestaurantId);
        }
        return restaurantRepository.findById(targetRestaurantId).stream()
                .map(this::mapToRestaurantWithBranches)
                .toList();
    }

    /**
     * Creates a new restaurant.
     */
    @Transactional
    public RestaurantWithBranchesDTO createRestaurant(RestaurantRequestDTO request) {
        Restaurant restaurant = Restaurant.builder()
                .name(request.name())
                .build();
        Restaurant saved = restaurantRepository.save(restaurant);
        return mapToRestaurantWithBranches(saved);
    }

    // ─── Branches ─────────────────────────────────────────────────────────────

    /**
     * Creates a new branch within the specified restaurant.
     */
    @Transactional
    public BranchResponseDTO createBranch(UUID restaurantId, BranchRequestDTO request) {
        Restaurant restaurant = restaurantRepository.findById(restaurantId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Restaurante no encontrado con id: " + restaurantId));

        if (Boolean.TRUE.equals(restaurant.getIsDemo())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Acción bloqueada: Las cuentas Demo solo permiten una sucursal.");
        }

        // Validación de límites según el plan
        String plan = restaurant.getSubscriptionPlan() != null ? restaurant.getSubscriptionPlan().toUpperCase().trim() : "INICIAL";
        long currentBranchCount = branchRepository.countByRestaurantId(restaurantId);

        if ("INICIAL".equals(plan) && currentBranchCount >= 1) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Has alcanzado el límite de 1 sucursal para tu Plan Inicial. Actualiza al Plan Pro para administrar hasta 5 sucursales.");
        } else if ("PRO".equals(plan) && currentBranchCount >= 5) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Has alcanzado el límite de 5 sucursales para tu Plan Pro. Contacta a soporte para adquirir el Plan Cadena con sucursales ilimitadas.");
        }

        Branch branch = Branch.builder()
                .restaurant(restaurant)
                .name(request.name())
                .address(request.address())
                .whatsappNumber(request.whatsappNumber())
                .webhookSecret(request.webhookSecret())
                .build();

        Branch saved = branchRepository.save(branch);
        return mapToBranchResponse(saved);
    }

    /**
     * Actualiza los datos de una sucursal. Solo se pisa lo que venga en la
     * peticion: un campo ausente conserva su valor, para que editar el nombre
     * no borre el numero de WhatsApp.
     */
    @Transactional
    public BranchResponseDTO updateBranch(UUID branchId, BranchRequestDTO request) {
        Branch branch = branchRepository.findById(branchId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Sucursal no encontrada con id: " + branchId));

        if (request.name() != null && !request.name().isBlank()) {
            branch.setName(request.name().trim());
        }
        if (request.address() != null) {
            branch.setAddress(request.address().trim());
        }
        if (request.whatsappNumber() != null) {
            String numero = request.whatsappNumber().trim();
            // El numero identifica a la sucursal ante WhatsApp: si ya es de
            // otra, el bot mandaria los mensajes a la cocina equivocada.
            branchRepository.findByWhatsappNumber(numero)
                    .filter(otra -> !otra.getId().equals(branchId))
                    .ifPresent(otra -> {
                        throw new ResponseStatusException(HttpStatus.CONFLICT,
                                "Ese número de WhatsApp ya está en uso por la sucursal " + otra.getName() + ".");
                    });
            branch.setWhatsappNumber(numero.isEmpty() ? null : numero);
        }
        if (request.webhookSecret() != null && !request.webhookSecret().isBlank()) {
            branch.setWebhookSecret(request.webhookSecret().trim());
        }

        return mapToBranchResponse(branchRepository.save(branch));
    }

    // ─── Users ────────────────────────────────────────────────────────────────

    /**
     * Creates a new user with the given role for any restaurant/branch.
     * Validates that username is unique.
     */
    @Transactional
    public CreateUserResponseDTO createUser(CreateUserRequestDTO request) {
        // Validate username uniqueness
        if (userRepository.findByUsername(request.username()).isPresent()) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT, "El nombre de usuario '" + request.username() + "' ya está en uso.");
        }

        Restaurant restaurant = restaurantRepository.findById(request.restaurantId())
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Restaurante no encontrado con id: " + request.restaurantId()));

        String plan = restaurant.getSubscriptionPlan() != null ? restaurant.getSubscriptionPlan().toUpperCase().trim() : "INICIAL";
        long currentUserCount = userRepository.countByRestaurantId(restaurant.getId());

        if ("INICIAL".equals(plan) && currentUserCount >= 5) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Has alcanzado el límite de 5 usuarios para el Plan Inicial. Actualiza al Plan Pro para registrar hasta 25 usuarios.");
        } else if ("PRO".equals(plan) && currentUserCount >= 25) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Has alcanzado el límite de 25 usuarios para el Plan Pro. Contacta a soporte para adquirir el Plan Cadena con usuarios ilimitados.");
        }

        Branch branch = null;
        if (request.branchId() != null) {
            branch = branchRepository.findById(request.branchId())
                    .orElseThrow(() -> new ResponseStatusException(
                            HttpStatus.NOT_FOUND, "Sucursal no encontrada con id: " + request.branchId()));
        }

        Role role = roleRepository.findById(request.roleId())
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Rol no encontrado con id: " + request.roleId()));

        User user = User.builder()
                .username(request.username())
                .passwordHash(passwordEncoder.encode(request.password()))
                .role(role)
                .restaurant(restaurant)
                .branch(branch)
                .build();

        User saved = userRepository.save(user);
        return mapToUserResponse(saved);
    }

    // ─── Mappers ──────────────────────────────────────────────────────────────

    private RestaurantWithBranchesDTO mapToRestaurantWithBranches(Restaurant restaurant) {
        List<BranchResponseDTO> branches = branchRepository
                .findByRestaurantId(restaurant.getId())
                .stream()
                .map(this::mapToBranchResponse)
                .toList();

        return new RestaurantWithBranchesDTO(
                restaurant.getId(),
                restaurant.getName(),
                restaurant.getActive(),
                restaurant.getCreatedAt(),
                branches);
    }

    private BranchResponseDTO mapToBranchResponse(Branch branch) {
        return new BranchResponseDTO(
                branch.getId(),
                branch.getRestaurant().getId(),
                branch.getRestaurant().getName(),
                branch.getName(),
                branch.getAddress(),
                branch.getWhatsappNumber(),
                branch.getN8nWebhookUrl(),
                branch.getActive(),
                branch.getCreatedAt());
    }

    private CreateUserResponseDTO mapToUserResponse(User user) {
        return new CreateUserResponseDTO(
                user.getId(),
                user.getUsername(),
                user.getRole() != null ? user.getRole().getName() : null,
                user.getRestaurant().getId(),
                user.getBranch() != null ? user.getBranch().getId() : null,
                user.getActive(),
                user.getCreatedAt());
    }
}
