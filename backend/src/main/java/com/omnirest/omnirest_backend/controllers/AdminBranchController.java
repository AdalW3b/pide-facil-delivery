package com.omnirest.omnirest_backend.controllers;

import com.omnirest.omnirest_backend.dtos.BranchRequestDTO;
import com.omnirest.omnirest_backend.dtos.BranchResponseDTO;
import com.omnirest.omnirest_backend.services.AdminService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/admin/restaurants/{restaurantId}/branches")
@RequiredArgsConstructor
@PreAuthorize("hasAnyAuthority('MANAGE_RESTAURANTS', 'SUPER_ADMIN', 'SYSTEM_ADMIN')")
public class AdminBranchController {

    private final AdminService adminService;

    @PostMapping
    public ResponseEntity<BranchResponseDTO> createBranch(
            @PathVariable UUID restaurantId,
            @Valid @RequestBody BranchRequestDTO request,
            @org.springframework.security.core.annotation.AuthenticationPrincipal
            com.omnirest.omnirest_backend.security.CustomUserDetails userDetails) {
        // Un dueño solo abre sucursales en su restaurante; el operador, en cualquiera.
        if (!"SYSTEM_ADMIN".equalsIgnoreCase(userDetails != null ? userDetails.roleName() : null)
                && (userDetails == null || !restaurantId.equals(userDetails.restaurantId()))) {
            throw new org.springframework.web.server.ResponseStatusException(
                    org.springframework.http.HttpStatus.NOT_FOUND, "Restaurante no encontrado con id: " + restaurantId);
        }
        return ResponseEntity.ok(adminService.createBranch(restaurantId, request));
    }
}
