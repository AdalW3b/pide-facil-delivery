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
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class RoleServiceTest {

    @Mock private RoleRepository roleRepository;
    @Mock private PermissionRepository permissionRepository;
    @Mock private RestaurantRepository restaurantRepository;
    @Mock private UserRepository userRepository;
    @InjectMocks private RoleService roleService;

    private UUID restaurantId;
    private Restaurant restaurant;
    private Restaurant otro;
    private Role systemRole;
    private Role customRole;
    private Role rolAjeno;
    private Permission permission;
    private Permission plataforma;
    private CustomUserDetails dueno;

    @BeforeEach
    void setUp() {
        restaurantId = UUID.randomUUID();
        restaurant = Restaurant.builder().id(restaurantId).name("Restaurante Test").build();
        otro = Restaurant.builder().id(UUID.randomUUID()).name("Otro").build();

        permission = Permission.builder().id(UUID.randomUUID()).name("TABLES_READ").description("Ver mesas").build();
        plataforma = Permission.builder().id(UUID.randomUUID()).name("MANAGE_RESTAURANTS").description("Plataforma").build();

        systemRole = Role.builder().id(UUID.randomUUID()).name("SUPER_ADMIN").isCustom(false)
                .permissions(List.of(permission)).build();
        customRole = Role.builder().id(UUID.randomUUID()).name("SUPERVISOR_TURNO").isCustom(true)
                .restaurant(restaurant).permissions(List.of(permission)).build();
        rolAjeno = Role.builder().id(UUID.randomUUID()).name("Cajero").isCustom(true)
                .restaurant(otro).permissions(List.of(permission)).build();

        dueno = new CustomUserDetails(UUID.randomUUID(), "admin", "pwd", "SUPER_ADMIN", "/admin", restaurantId, null, List.of());

        when(restaurantRepository.findById(restaurantId)).thenReturn(Optional.of(restaurant));
        when(permissionRepository.findAll()).thenReturn(List.of(permission, plataforma));
        when(permissionRepository.findAllById(List.of(permission.getId()))).thenReturn(List.of(permission));
        when(permissionRepository.findAllById(List.of(plataforma.getId()))).thenReturn(List.of(plataforma));
        when(roleRepository.findById(customRole.getId())).thenReturn(Optional.of(customRole));
        when(roleRepository.findById(systemRole.getId())).thenReturn(Optional.of(systemRole));
        when(roleRepository.findById(rolAjeno.getId())).thenReturn(Optional.of(rolAjeno));
        when(roleRepository.save(any(Role.class))).thenAnswer(i -> {
            Role r = i.getArgument(0);
            if (r.getId() == null) r.setId(UUID.randomUUID());
            return r;
        });
    }

    private RoleRequestDTO peticion(String nombre, UUID restaurante, List<UUID> permisos) {
        return new RoleRequestDTO(nombre, "Desc", "/dashboard", restaurante, permisos);
    }

    private static HttpStatus estado(Runnable r) {
        ResponseStatusException e = assertThrows(ResponseStatusException.class, r::run);
        return HttpStatus.valueOf(e.getStatusCode().value());
    }

    @Test
    @DisplayName("createRole crea un rol personalizado en el restaurante de quien lo crea")
    void createRole_Success_CreatesCustomRole() {
        // Aunque pida otro restaurante, se crea en el suyo.
        RoleDTO result = roleService.createRole(peticion("Capitán de meseros", otro.getId(), List.of(permission.getId())), dueno);

        assertEquals("Capitán de meseros", result.name());
        assertTrue(result.isCustom());
        assertEquals(restaurantId, result.restaurantId());
        assertEquals(1, result.permissions().size());
    }

    @Test
    @DisplayName("createRole: 409 si el restaurante ya tiene un rol con ese nombre")
    void createRole_DuplicateName_ThrowsConflict() {
        when(roleRepository.existeEnRestaurante(eq("SUPERVISOR_TURNO"), eq(restaurantId), isNull())).thenReturn(true);
        assertEquals(HttpStatus.CONFLICT, estado(() ->
                roleService.createRole(peticion("SUPERVISOR_TURNO", null, List.of()), dueno)));
    }

    @Test
    @DisplayName("createRole: un permiso de plataforma no entra en un rol de restaurante")
    void createRole_PermisoDePlataforma() {
        assertEquals(HttpStatus.FORBIDDEN, estado(() ->
                roleService.createRole(peticion("Gerente", null, List.of(plataforma.getId())), dueno)));
        verify(roleRepository, never()).save(any());
    }

    @Test
    @DisplayName("createRole: un nombre de rol del sistema no se puede usar, con cualquier mayúscula")
    void createRole_NombreReservado() {
        assertEquals(HttpStatus.BAD_REQUEST, estado(() ->
                roleService.createRole(peticion("super_admin", null, List.of()), dueno)));
    }

    @Test
    @DisplayName("updateRole no deja editar roles del sistema")
    void updateRole_SystemRole_ThrowsForbidden() {
        assertEquals(HttpStatus.FORBIDDEN, estado(() ->
                roleService.updateRole(systemRole.getId(), peticion("SUPER_ADMIN_MOD", null, List.of()), dueno)));
    }

    @Test
    @DisplayName("updateRole y deleteRole: un rol de otro restaurante responde no encontrado")
    void rolDeOtroRestaurante() {
        assertEquals(HttpStatus.NOT_FOUND, estado(() ->
                roleService.updateRole(rolAjeno.getId(), peticion("Cajero", null, List.of()), dueno)));
        assertEquals(HttpStatus.NOT_FOUND, estado(() -> roleService.deleteRole(rolAjeno.getId(), dueno)));
        verify(roleRepository, never()).save(any());
        verify(roleRepository, never()).delete(any());
    }

    @Test
    @DisplayName("updateRole no mueve el rol a otro restaurante aunque se pida")
    void updateRole_NoCambiaDeRestaurante() {
        roleService.updateRole(customRole.getId(), peticion("Supervisor", otro.getId(), List.of(permission.getId())), dueno);
        ArgumentCaptor<Role> captor = ArgumentCaptor.forClass(Role.class);
        verify(roleRepository).save(captor.capture());
        assertEquals(restaurantId, captor.getValue().getRestaurant().getId());
        assertEquals("Supervisor", captor.getValue().getName());
    }

    @Test
    @DisplayName("deleteRole no deja borrar roles del sistema")
    void deleteRole_SystemRole_ThrowsForbidden() {
        assertEquals(HttpStatus.FORBIDDEN, estado(() -> roleService.deleteRole(systemRole.getId(), dueno)));
        verify(roleRepository, never()).delete(any(Role.class));
    }

    @Test
    @DisplayName("deleteRole: un rol que tienen empleados no se borra, y lo dice claro")
    void deleteRole_EnUso() {
        when(userRepository.countByRoleId(customRole.getId())).thenReturn(3L);
        ResponseStatusException e = assertThrows(ResponseStatusException.class,
                () -> roleService.deleteRole(customRole.getId(), dueno));
        assertEquals(HttpStatus.CONFLICT.value(), e.getStatusCode().value());
        assertTrue(e.getReason().contains("3 empleados"));

        when(userRepository.countByRoleId(customRole.getId())).thenReturn(0L);
        roleService.deleteRole(customRole.getId(), dueno);
        verify(roleRepository).delete(customRole);
    }

    @Test
    @DisplayName("La cuenta demo no deja editar ni borrar roles")
    void demo() {
        restaurant.setIsDemo(true);
        assertEquals(HttpStatus.FORBIDDEN, estado(() ->
                roleService.updateRole(customRole.getId(), peticion("X", null, List.of()), dueno)));
        assertEquals(HttpStatus.FORBIDDEN, estado(() -> roleService.deleteRole(customRole.getId(), dueno)));
    }

    @Test
    @DisplayName("Al restaurante no se le muestran el rol del operador ni los permisos de plataforma")
    void listados() {
        Role operador = Role.builder().id(UUID.randomUUID()).name("SYSTEM_ADMIN").isCustom(false).permissions(List.of()).build();
        when(roleRepository.findByRestaurantIdOrGlobal(restaurantId)).thenReturn(List.of(operador, systemRole, customRole));

        List<String> roles = roleService.listRoles(dueno).stream().map(RoleDTO::name).toList();
        assertEquals(List.of("SUPER_ADMIN", "SUPERVISOR_TURNO"), roles);

        CustomUserDetails gerente = new CustomUserDetails(UUID.randomUUID(), "g", "x", "BRANCH_MANAGER", "/", restaurantId, null, List.of());
        assertEquals(List.of("SUPERVISOR_TURNO"), roleService.listRoles(gerente).stream().map(RoleDTO::name).toList(),
                "el gerente no ve el rol de dueño, que no puede asignar");

        assertEquals(List.of("TABLES_READ"), roleService.listPermissions(dueno).stream().map(PermissionDTO::name).toList());
    }
}
