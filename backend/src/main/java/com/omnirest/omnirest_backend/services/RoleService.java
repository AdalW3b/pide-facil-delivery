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
import com.omnirest.omnirest_backend.repositories.UserRepository;
import com.omnirest.omnirest_backend.security.CustomUserDetails;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.UUID;

/**
 * Los roles de cada restaurante. Cada restaurante ve los roles del sistema y
 * los suyos, y solo toca los suyos. Que permisos puede llevar un rol lo decide
 * {@link ReglasDeRoles}: nadie da mas de lo que tiene.
 */
@Service
@RequiredArgsConstructor
public class RoleService {

    private final RoleRepository roleRepository;
    private final PermissionRepository permissionRepository;
    private final RestaurantRepository restaurantRepository;
    private final UserRepository userRepository;

    /** Los permisos que se pueden poner en un rol. Los de plataforma solo los ve el operador. */
    @Transactional(readOnly = true)
    public List<PermissionDTO> listPermissions(CustomUserDetails userDetails) {
        boolean operador = ReglasDeRoles.esOperador(userDetails);
        return permissionRepository.findAll().stream()
                .filter(p -> operador || !ReglasDeRoles.esReservado(p.getName()))
                .map(p -> new PermissionDTO(p.getId(), p.getName(), p.getDescription()))
                .toList();
    }

    /**
     * Los roles del sistema y los del restaurante. El del operador solo lo ve
     * el operador, y el de dueño no lo ve quien no puede asignarlo.
     */
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
        boolean operador = ReglasDeRoles.esOperador(userDetails);
        boolean dueno = ReglasDeRoles.esDueno(userDetails);

        return roleRepository.findByRestaurantIdOrGlobal(restaurantId).stream()
                .filter(r -> operador || r.getRestaurant() != null || !"SYSTEM_ADMIN".equalsIgnoreCase(r.getName()))
                .filter(r -> operador || dueno || r.getRestaurant() != null || !"SUPER_ADMIN".equalsIgnoreCase(r.getName()))
                .map(this::mapToRoleDTO)
                .toList();
    }

    @Transactional
    public RoleDTO createRole(RoleRequestDTO request, CustomUserDetails userDetails) {
        // Un rol se crea en el restaurante de quien lo crea. Solo el operador,
        // que no tiene restaurante, elige en cual.
        UUID targetRestaurantId = userDetails != null && userDetails.restaurantId() != null
                ? userDetails.restaurantId()
                : (ReglasDeRoles.esOperador(userDetails) ? request.restaurantId() : null);

        if (targetRestaurantId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Debe especificar un restaurantId para crear el rol.");
        }

        final UUID finalRestaurantId = targetRestaurantId;
        Restaurant restaurant = restaurantRepository.findById(finalRestaurantId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Restaurante no encontrado: " + finalRestaurantId));
        exigirNoDemo(restaurant);

        List<Permission> permissions = resolvePermissions(request.permissionIds());
        ReglasDeRoles.exigirPuedeOtorgar(userDetails, permissions.stream().map(Permission::getName).toList());
        String nombre = nombreDisponible(request.name(), restaurant.getId(), null);

        Role role = Role.builder()
                .name(nombre)
                .description(request.description())
                .defaultRoute(ReglasDeRoles.exigirRuta(request.defaultRoute()))
                .isCustom(true)
                .restaurant(restaurant)
                .permissions(permissions)
                .build();

        return mapToRoleDTO(roleRepository.save(role));
    }

    @Transactional
    public RoleDTO updateRole(UUID roleId, RoleRequestDTO request, CustomUserDetails userDetails) {
        Role role = rolPropio(roleId, userDetails);

        if (Boolean.FALSE.equals(role.getIsCustom()) || role.getRestaurant() == null) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "No se pueden editar roles del sistema.");
        }
        exigirNoDemo(role.getRestaurant());

        List<Permission> permissions = resolvePermissions(request.permissionIds());
        ReglasDeRoles.exigirPuedeOtorgar(userDetails, permissions.stream().map(Permission::getName).toList());

        // El restaurante de un rol no cambia: moverlo seria regalarselo a otro.
        role.setName(nombreDisponible(request.name(), role.getRestaurant().getId(), role.getId()));
        role.setDescription(request.description());
        role.setDefaultRoute(ReglasDeRoles.exigirRuta(request.defaultRoute()));
        role.setPermissions(permissions);

        return mapToRoleDTO(roleRepository.save(role));
    }

    @Transactional
    public void deleteRole(UUID roleId, CustomUserDetails userDetails) {
        Role role = rolPropio(roleId, userDetails);

        if (Boolean.FALSE.equals(role.getIsCustom()) || role.getRestaurant() == null) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "No se pueden eliminar roles del sistema.");
        }
        exigirNoDemo(role.getRestaurant());

        // Cada empleado tiene que tener un rol: primero hay que cambiarselo.
        long enUso = userRepository.countByRoleId(role.getId());
        if (enUso > 0) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, enUso == 1
                    ? "Un empleado tiene este rol. Asígnale otro antes de eliminarlo."
                    : enUso + " empleados tienen este rol. Asígnales otro antes de eliminarlo.");
        }

        roleRepository.delete(role);
    }

    /**
     * El rol, si es del sistema o del restaurante de quien lo pide. Uno de otro
     * restaurante responde "no encontrado", sin decir que existe.
     */
    private Role rolPropio(UUID roleId, CustomUserDetails userDetails) {
        Role role = roleRepository.findById(roleId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Rol no encontrado: " + roleId));
        if (ReglasDeRoles.esOperador(userDetails) || role.getRestaurant() == null) {
            return role;
        }
        UUID propio = userDetails != null ? userDetails.restaurantId() : null;
        if (propio == null || !propio.equals(role.getRestaurant().getId())) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Rol no encontrado: " + roleId);
        }
        return role;
    }

    /** El nombre limpio, si no es reservado ni lo usa ya otro rol del restaurante o del sistema. */
    private String nombreDisponible(String nombre, UUID restaurantId, UUID excepto) {
        List<String> permisos = permissionRepository.findAll().stream().map(Permission::getName).toList();
        String limpio = ReglasDeRoles.exigirNombreValido(nombre, permisos);
        if (roleRepository.existeDelSistema(limpio) || roleRepository.existeEnRestaurante(limpio, restaurantId, excepto)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Ya existe un rol con el nombre: " + limpio);
        }
        return limpio;
    }

    private static void exigirNoDemo(Restaurant restaurant) {
        if (restaurant != null && Boolean.TRUE.equals(restaurant.getIsDemo())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Acción bloqueada: La estructura de roles está predefinida en la Demo.");
        }
    }

    private List<Permission> resolvePermissions(List<UUID> permissionIds) {
        List<UUID> ids = permissionIds == null ? List.of() : List.copyOf(new LinkedHashSet<>(permissionIds));
        List<Permission> permissions = permissionRepository.findAllById(ids);
        if (permissions.size() != ids.size()) {
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
