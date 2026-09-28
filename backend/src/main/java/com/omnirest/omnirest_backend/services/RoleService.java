package com.omnirest.omnirest_backend.services;

import com.omnirest.omnirest_backend.domain.entities.Permission;
import com.omnirest.omnirest_backend.domain.entities.Restaurant;
import com.omnirest.omnirest_backend.domain.entities.Role;
import com.omnirest.omnirest_backend.dtos.PermissionDTO;
import com.omnirest.omnirest_backend.dtos.RoleDTO;
import com.omnirest.omnirest_backend.dtos.RoleRequestDTO;
import com.omnirest.omnirest_backend.repositories.PermissionRepository;
import com.omnirest.omnirest_backend.repositories.RestaurantRepository;
import com.omnirest.omnirest_backend.repositories.RoleRepository;
import com.omnirest.omnirest_backend.security.CustomUserDetails;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class RoleService {

    private final RoleRepository roleRepository;
    private final PermissionRepository permissionRepository;
    private final RestaurantRepository restaurantRepository;

    @Transactional(readOnly = true)
    public List<PermissionDTO> listPermissions() {
        return permissionRepository.findAll().stream()
                .map(p -> new PermissionDTO(p.getId(), p.getName(), p.getDescription()))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<RoleDTO> listRoles(CustomUserDetails userDetails) {
        UUID restaurantId = userDetails != null ? userDetails.restaurantId() : null;
        boolean isDemo = restaurantId != null && restaurantRepository.findById(restaurantId)
                .map(r -> Boolean.TRUE.equals(r.getIsDemo()))
                .orElse(false);
        if (isDemo) {
            restaurantId = restaurantRepository.findAll().stream()
                    .filter(r -> Boolean.TRUE.equals(r.getIsDemo()))
                    .map(Restaurant::getId)
                    .findFirst()
                    .orElse(restaurantId);
        }
        List<Role> roles = roleRepository.findByRestaurantIdOrGlobal(restaurantId);

        return roles.stream()
                .map(this::mapToRoleDTO)
                .toList();
    }

    @Transactional
    public RoleDTO createRole(RoleRequestDTO request, CustomUserDetails userDetails) {
        if (roleRepository.findByName(request.name()).isPresent()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Ya existe un rol con el nombre: " + request.name());
        }

        UUID targetRestaurantId = userDetails != null && userDetails.restaurantId() != null
                ? userDetails.restaurantId()
                : request.restaurantId();

        if (targetRestaurantId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Debe especificar un restaurantId para crear el rol.");
        }

        final UUID finalRestaurantId = targetRestaurantId;
        Restaurant restaurant = restaurantRepository.findById(finalRestaurantId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Restaurante no encontrado: " + finalRestaurantId));

        if (Boolean.TRUE.equals(restaurant.getIsDemo())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Acción bloqueada: La estructura de roles está predefinida en la Demo.");
        }

        List<Permission> permissions = resolvePermissions(request.permissionIds());

        Role role = Role.builder()
                .name(request.name())
                .description(request.description())
                .defaultRoute(request.defaultRoute())
                .isCustom(true)
                .restaurant(restaurant)
                .permissions(permissions)
                .build();

        return mapToRoleDTO(roleRepository.save(role));
    }

    @Transactional
    public RoleDTO updateRole(UUID roleId, RoleRequestDTO request, CustomUserDetails userDetails) {
        Role role = roleRepository.findById(roleId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Rol no encontrado: " + roleId));

        if (Boolean.FALSE.equals(role.getIsCustom())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "No se pueden editar roles del sistema.");
        }

        if (request.restaurantId() != null) {
            Restaurant restaurant = restaurantRepository.findById(request.restaurantId())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                            "Restaurante no encontrado: " + request.restaurantId()));
            role.setRestaurant(restaurant);
        }

        role.setName(request.name());
        role.setDescription(request.description());
        role.setDefaultRoute(request.defaultRoute());
        role.setPermissions(resolvePermissions(request.permissionIds()));

        return mapToRoleDTO(roleRepository.save(role));
    }

    @Transactional
    public void deleteRole(UUID roleId) {
        Role role = roleRepository.findById(roleId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Rol no encontrado: " + roleId));

        if (Boolean.FALSE.equals(role.getIsCustom())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "No se pueden eliminar roles del sistema.");
        }

        roleRepository.delete(role);
    }

    private List<Permission> resolvePermissions(List<UUID> permissionIds) {
        List<Permission> permissions = permissionRepository.findAllById(permissionIds);
        if (permissions.size() != permissionIds.size()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Uno o más permissionIds no existen.");
        }
        return permissions;
    }

    private RoleDTO mapToRoleDTO(Role role) {
        List<PermissionDTO> permissionDTOs = role.getPermissions() == null ? List.of()
                : role.getPermissions().stream()
                        .map(p -> new PermissionDTO(p.getId(), p.getName(), p.getDescription()))
                        .toList();

        return new RoleDTO(
                role.getId(),
                role.getName(),
                role.getDescription(),
                role.getIsCustom(),
                role.getDefaultRoute(),
                role.getRestaurant() != null ? role.getRestaurant().getId() : null,
                permissionDTOs);
    }
}
