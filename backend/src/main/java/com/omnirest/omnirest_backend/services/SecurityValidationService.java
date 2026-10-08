package com.omnirest.omnirest_backend.services;

import com.omnirest.omnirest_backend.domain.entities.Branch;
import com.omnirest.omnirest_backend.repositories.BranchRepository;
import com.omnirest.omnirest_backend.repositories.RestaurantRepository;
import com.omnirest.omnirest_backend.security.CustomUserDetails;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class SecurityValidationService {

    private final BranchRepository branchRepository;
    private final RestaurantRepository restaurantRepository;

    public void validateUserAccessToBranch(UUID branchId) {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !(authentication.getPrincipal() instanceof CustomUserDetails userDetails)) {
            throw new AccessDeniedException("User is not authenticated");
        }

        if ("SYSTEM_ADMIN".equalsIgnoreCase(userDetails.roleName())) {
            return; // SYSTEM_ADMIN tiene acceso global de auditoría a todas las sucursales
        }

        Branch branch = branchRepository.findById(branchId)
                .orElseThrow(() -> new IllegalArgumentException("Branch not found: " + branchId));

        boolean userIsDemo = userDetails.restaurantId() != null && restaurantRepository.findById(userDetails.restaurantId())
                .map(r -> Boolean.TRUE.equals(r.getIsDemo()))
                .orElse(false);
        if (userIsDemo && branch.getRestaurant() != null && Boolean.TRUE.equals(branch.getRestaurant().getIsDemo())) {
            return; // Demo users have access to demo branches
        }

        boolean isSuperAdmin = "SUPER_ADMIN".equalsIgnoreCase(userDetails.roleName());
        boolean isBranchManager = "BRANCH_MANAGER".equalsIgnoreCase(userDetails.roleName());

        if (isBranchManager) {
            if (userDetails.branchId() == null || !userDetails.branchId().equals(branchId)) {
                throw new AccessDeniedException("Access denied: Branch manager can only access their assigned branch");
            }
        } else if (isSuperAdmin) {
            if (userDetails.restaurantId() == null || !userDetails.restaurantId().equals(branch.getRestaurant().getId())) {
                throw new AccessDeniedException("Access denied: Branch does not belong to the restaurant of the super admin");
            }
        } else {
            if (userDetails.branchId() != null && userDetails.branchId().equals(branchId)) {
                return;
            }
            if (userDetails.restaurantId() != null) {
                if (userDetails.restaurantId().equals(branch.getRestaurant().getId())) {
                    return;
                }
            }
            throw new AccessDeniedException("Access denied: Role not authorized or branch mismatch");
        }
    }

    /**
     * El costeo de una sucursal: el dueño ve el de cualquiera de las suyas;
     * cualquier otro empleado, solo el de la sucursal que tiene asignada, aunque
     * su rol le deje operar otras.
     */
    public void validarCosteoDeSucursal(UUID branchId) {
        validateUserAccessToBranch(branchId);
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        CustomUserDetails u = (CustomUserDetails) authentication.getPrincipal();
        if ("SYSTEM_ADMIN".equalsIgnoreCase(u.roleName()) || "SUPER_ADMIN".equalsIgnoreCase(u.roleName())) {
            return;
        }
        if (u.branchId() == null || !u.branchId().equals(branchId)) {
            throw new AccessDeniedException("Solo puedes ver el costeo de tu sucursal.");
        }
    }

    private boolean hasAuthority(CustomUserDetails userDetails, String authority) {
        return userDetails.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals(authority));
    }
}
