package com.omnirest.omnirest_backend.controllers;

import com.omnirest.omnirest_backend.dtos.RestaurantRequestDTO;
import com.omnirest.omnirest_backend.dtos.RestaurantWithBranchesDTO;
import com.omnirest.omnirest_backend.services.AdminService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

import com.omnirest.omnirest_backend.security.CustomUserDetails;
import org.springframework.security.core.annotation.AuthenticationPrincipal;

@RestController
@RequestMapping("/api/v1/admin/restaurants")
@RequiredArgsConstructor
@PreAuthorize("hasAnyAuthority('MANAGE_RESTAURANTS', 'SUPER_ADMIN', 'SYSTEM_ADMIN')")
public class AdminRestaurantController {

    private final AdminService adminService;

    @GetMapping
    public ResponseEntity<List<RestaurantWithBranchesDTO>> getAll(
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        return ResponseEntity.ok(adminService.getAllRestaurantsWithBranches(userDetails));
    }

    /** Dar de alta un restaurante es del operador de la plataforma, no de un dueño. */
    @PostMapping
    @PreAuthorize("hasAuthority('SYSTEM_ADMIN')")
    public ResponseEntity<RestaurantWithBranchesDTO> create(
            @Valid @RequestBody RestaurantRequestDTO request) {
        return ResponseEntity.ok(adminService.createRestaurant(request));
    }
}
