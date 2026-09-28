package com.omnirest.omnirest_backend.services;

import com.omnirest.omnirest_backend.domain.entities.Permission;
import com.omnirest.omnirest_backend.domain.entities.Restaurant;
import com.omnirest.omnirest_backend.domain.entities.Role;
import com.omnirest.omnirest_backend.dtos.RoleDTO;
import com.omnirest.omnirest_backend.dtos.RoleRequestDTO;
import com.omnirest.omnirest_backend.repositories.PermissionRepository;
import com.omnirest.omnirest_backend.repositories.RestaurantRepository;
import com.omnirest.omnirest_backend.repositories.RoleRepository;
import com.omnirest.omnirest_backend.security.CustomUserDetails;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class RoleServiceTest {

    @Mock
    private RoleRepository roleRepository;

    @Mock
    private PermissionRepository permissionRepository;

    @Mock
    private RestaurantRepository restaurantRepository;

    @InjectMocks
    private RoleService roleService;

    private UUID restaurantId;
    private Restaurant restaurant;
    private Role systemRole;
    private Role customRole;
    private Permission permission;
    private CustomUserDetails user;

    @BeforeEach
    void setUp() {
        restaurantId = UUID.randomUUID();
        restaurant = Restaurant.builder()
                .id(restaurantId)
                .name("Restaurante Test")
                .build();

        permission = Permission.builder()
                .id(UUID.randomUUID())
                .name("TABLES_READ")
                .description("Ver mesas")
                .build();

        systemRole = Role.builder()
                .id(UUID.randomUUID())
                .name("SUPER_ADMIN")
                .isCustom(false)
                .permissions(List.of(permission))
                .build();

        customRole = Role.builder()
                .id(UUID.randomUUID())
                .name("SUPERVISOR_TURNO")
                .isCustom(true)
                .restaurant(restaurant)
                .permissions(List.of(permission))
                .build();

        user = new CustomUserDetails(
                UUID.randomUUID(), "admin", "pwd", "SUPER_ADMIN", "/admin", restaurantId, null, List.of());
    }

    @Test
    @DisplayName("createRole creates custom role with permissions")
    void createRole_Success_CreatesCustomRole() {
        RoleRequestDTO request = new RoleRequestDTO(
                "CAPITAN_MESEROS",
                "Capitán de piso",
                "/tables",
                restaurantId,
                List.of(permission.getId())
        );

        when(roleRepository.findByName("CAPITAN_MESEROS")).thenReturn(Optional.empty());
        when(restaurantRepository.findById(restaurantId)).thenReturn(Optional.of(restaurant));
        when(permissionRepository.findAllById(List.of(permission.getId()))).thenReturn(List.of(permission));
        when(roleRepository.save(any(Role.class))).thenAnswer(invocation -> {
            Role r = invocation.getArgument(0);
            r.setId(UUID.randomUUID());
            return r;
        });

        RoleDTO result = roleService.createRole(request, user);

        assertNotNull(result);
        assertEquals("CAPITAN_MESEROS", result.name());
        assertTrue(result.isCustom());
        assertEquals(1, result.permissions().size());
        verify(roleRepository).save(any(Role.class));
    }

    @Test
    @DisplayName("createRole throws CONFLICT 409 when role name already exists")
    void createRole_DuplicateName_ThrowsConflict() {
        RoleRequestDTO request = new RoleRequestDTO(
                "SUPERVISOR_TURNO",
                "Desc",
                "/tables",
                restaurantId,
                List.of()
        );

        when(roleRepository.findByName("SUPERVISOR_TURNO")).thenReturn(Optional.of(customRole));

        ResponseStatusException ex = assertThrows(
                ResponseStatusException.class,
                () -> roleService.createRole(request, user)
        );

        assertEquals(HttpStatus.CONFLICT, ex.getStatusCode());
    }

    @Test
    @DisplayName("updateRole throws FORBIDDEN 403 when trying to edit system role")
    void updateRole_SystemRole_ThrowsForbidden() {
        RoleRequestDTO request = new RoleRequestDTO("SUPER_ADMIN_MOD", "Desc", "/admin", null, List.of());

        when(roleRepository.findById(systemRole.getId())).thenReturn(Optional.of(systemRole));

        ResponseStatusException ex = assertThrows(
                ResponseStatusException.class,
                () -> roleService.updateRole(systemRole.getId(), request, user)
        );

        assertEquals(HttpStatus.FORBIDDEN, ex.getStatusCode());
    }

    @Test
    @DisplayName("deleteRole throws FORBIDDEN 403 when trying to delete system role")
    void deleteRole_SystemRole_ThrowsForbidden() {
        when(roleRepository.findById(systemRole.getId())).thenReturn(Optional.of(systemRole));

        ResponseStatusException ex = assertThrows(
                ResponseStatusException.class,
                () -> roleService.deleteRole(systemRole.getId())
        );

        assertEquals(HttpStatus.FORBIDDEN, ex.getStatusCode());
        verify(roleRepository, never()).delete(any(Role.class));
    }
}
