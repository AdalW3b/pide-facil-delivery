package com.omnirest.omnirest_backend.services;

import com.omnirest.omnirest_backend.domain.entities.Branch;
import com.omnirest.omnirest_backend.domain.entities.Restaurant;
import com.omnirest.omnirest_backend.repositories.BranchRepository;
import com.omnirest.omnirest_backend.repositories.RestaurantRepository;
import com.omnirest.omnirest_backend.security.CustomUserDetails;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SecurityValidationServiceTest {

    @Mock
    private BranchRepository branchRepository;

    @Mock
    private RestaurantRepository restaurantRepository;

    @InjectMocks
    private SecurityValidationService securityValidationService;

    private UUID restaurantId;
    private UUID branchId;
    private Branch branch;

    @BeforeEach
    void setUp() {
        restaurantId = UUID.randomUUID();
        branchId = UUID.randomUUID();

        Restaurant restaurant = Restaurant.builder()
                .id(restaurantId)
                .name("Restaurante Test")
                .build();

        branch = Branch.builder()
                .id(branchId)
                .restaurant(restaurant)
                .name("Sucursal Principal")
                .build();

        // El servicio carga la sucursal antes de revisar el rol (para saber si
        // es de demo), asi que todas las pruebas la necesitan.
        lenient().when(branchRepository.findById(branchId)).thenReturn(Optional.of(branch));
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    private void authenticateUser(CustomUserDetails userDetails) {
        UsernamePasswordAuthenticationToken auth =
                new UsernamePasswordAuthenticationToken(userDetails, null, userDetails.getAuthorities());
        SecurityContextHolder.getContext().setAuthentication(auth);
    }

    @Test
    @DisplayName("Throws AccessDeniedException when user is not authenticated")
    void validateUserAccessToBranch_Unauthenticated_ThrowsAccessDeniedException() {
        SecurityContextHolder.clearContext();

        assertThrows(AccessDeniedException.class, () ->
                securityValidationService.validateUserAccessToBranch(branchId));
    }

    @Test
    @DisplayName("SuperAdmin can access branch belonging to their restaurant")
    void validateUserAccessToBranch_SuperAdmin_SameRestaurant_Success() {
        CustomUserDetails user = new CustomUserDetails(
                UUID.randomUUID(), "superadmin", "pwd", "SUPER_ADMIN", "/admin", restaurantId, null, List.of());
        authenticateUser(user);

        when(branchRepository.findById(branchId)).thenReturn(Optional.of(branch));

        assertDoesNotThrow(() -> securityValidationService.validateUserAccessToBranch(branchId));
    }

    @Test
    @DisplayName("SuperAdmin cannot access branch belonging to another restaurant")
    void validateUserAccessToBranch_SuperAdmin_DifferentRestaurant_ThrowsAccessDeniedException() {
        UUID otherRestaurantId = UUID.randomUUID();
        CustomUserDetails user = new CustomUserDetails(
                UUID.randomUUID(), "superadmin", "pwd", "SUPER_ADMIN", "/admin", otherRestaurantId, null, List.of());
        authenticateUser(user);

        when(branchRepository.findById(branchId)).thenReturn(Optional.of(branch));

        assertThrows(AccessDeniedException.class, () ->
                securityValidationService.validateUserAccessToBranch(branchId));
    }

    @Test
    @DisplayName("BranchManager can access their assigned branch")
    void validateUserAccessToBranch_BranchManager_SameBranch_Success() {
        CustomUserDetails user = new CustomUserDetails(
                UUID.randomUUID(), "manager", "pwd", "BRANCH_MANAGER", "/dashboard", restaurantId, branchId, List.of());
        authenticateUser(user);

        assertDoesNotThrow(() -> securityValidationService.validateUserAccessToBranch(branchId));
    }

    @Test
    @DisplayName("BranchManager cannot access another branch")
    void validateUserAccessToBranch_BranchManager_DifferentBranch_ThrowsAccessDeniedException() {
        UUID otherBranchId = UUID.randomUUID();
        CustomUserDetails user = new CustomUserDetails(
                UUID.randomUUID(), "manager", "pwd", "BRANCH_MANAGER", "/dashboard", restaurantId, otherBranchId, List.of());
        authenticateUser(user);

        assertThrows(AccessDeniedException.class, () ->
                securityValidationService.validateUserAccessToBranch(branchId));
    }

    @Test
    @DisplayName("Staff/Waiter assigned to branch can access their branch")
    void validateUserAccessToBranch_Staff_SameBranch_Success() {
        CustomUserDetails user = new CustomUserDetails(
                UUID.randomUUID(), "waiter1", "pwd", "MESERO", "/tables", restaurantId, branchId, List.of());
        authenticateUser(user);

        assertDoesNotThrow(() -> securityValidationService.validateUserAccessToBranch(branchId));
    }

    @Test
    @DisplayName("Staff/Waiter assigned to different branch cannot access other branch")
    void validateUserAccessToBranch_Staff_DifferentBranch_ThrowsAccessDeniedException() {
        UUID otherBranchId = UUID.randomUUID();
        CustomUserDetails user = new CustomUserDetails(
                UUID.randomUUID(), "waiter1", "pwd", "MESERO", "/tables", null, otherBranchId, List.of());
        authenticateUser(user);

        assertThrows(AccessDeniedException.class, () ->
                securityValidationService.validateUserAccessToBranch(branchId));
    }
}
