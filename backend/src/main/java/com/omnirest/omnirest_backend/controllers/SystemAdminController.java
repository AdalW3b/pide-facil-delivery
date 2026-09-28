package com.omnirest.omnirest_backend.controllers;

import com.omnirest.omnirest_backend.dtos.TenantCreatorDTO;
import com.omnirest.omnirest_backend.services.DemoSeederService;
import com.omnirest.omnirest_backend.services.SystemAdminService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/system/creators")
@RequiredArgsConstructor
@PreAuthorize("hasAuthority('SYSTEM_ADMIN')")
public class SystemAdminController {

    private final SystemAdminService systemAdminService;
    private final DemoSeederService demoSeederService;

    @GetMapping
    public ResponseEntity<List<TenantCreatorDTO>> getCreators() {
        return ResponseEntity.ok(systemAdminService.getAllRestaurantOwners());
    }

    @PatchMapping("/{userId}/toggle")
    public ResponseEntity<TenantCreatorDTO> toggleStatus(@PathVariable UUID userId) {
        return ResponseEntity.ok(systemAdminService.toggleCreatorStatus(userId));
    }

    @PatchMapping("/restaurants/{restaurantId}/demo/toggle")
    public ResponseEntity<TenantCreatorDTO> toggleDemo(@PathVariable UUID restaurantId) {
        return ResponseEntity.ok(systemAdminService.toggleDemoMode(restaurantId));
    }

    @PostMapping("/demo/reset")
    public ResponseEntity<Map<String, String>> resetDemoEnvironment() {
        demoSeederService.resetDemoData();
        return ResponseEntity.ok(Map.of("message", "Base de datos Demo reseteada a su estado inicial."));
    }
}