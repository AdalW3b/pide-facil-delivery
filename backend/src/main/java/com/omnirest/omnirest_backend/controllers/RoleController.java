package com.omnirest.omnirest_backend.controllers;

import com.omnirest.omnirest_backend.dtos.PermissionDTO;
import com.omnirest.omnirest_backend.dtos.RoleDTO;
import com.omnirest.omnirest_backend.dtos.RoleRequestDTO;
import com.omnirest.omnirest_backend.security.CustomUserDetails;
import com.omnirest.omnirest_backend.services.RoleService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/admin")
@RequiredArgsConstructor
public class RoleController {

    private final RoleService roleService;

    @GetMapping("/permissions")
    @PreAuthorize("hasAuthority('USERS_READ')")
    public ResponseEntity<List<PermissionDTO>> listPermissions(@AuthenticationPrincipal CustomUserDetails userDetails) {
        return ResponseEntity.ok(roleService.listPermissions(userDetails));
    }

    @GetMapping("/roles")
    @PreAuthorize("hasAuthority('USERS_READ')")
    public ResponseEntity<List<RoleDTO>> listRoles(@AuthenticationPrincipal CustomUserDetails userDetails) {
        return ResponseEntity.ok(roleService.listRoles(userDetails));
    }

    @PostMapping("/roles")
    @PreAuthorize("hasAuthority('USERS_CREATE')")
    public ResponseEntity<RoleDTO> createRole(
            @Valid @RequestBody RoleRequestDTO request,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        return ResponseEntity.ok(roleService.createRole(request, userDetails));
    }

    @PutMapping("/roles/{roleId}")
    @PreAuthorize("hasAuthority('USERS_UPDATE')")
    public ResponseEntity<RoleDTO> updateRole(
            @PathVariable UUID roleId,
            @Valid @RequestBody RoleRequestDTO request,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        return ResponseEntity.ok(roleService.updateRole(roleId, request, userDetails));
    }

    @DeleteMapping("/roles/{roleId}")
    @PreAuthorize("hasAuthority('USERS_DELETE')")
    public ResponseEntity<Void> deleteRole(@PathVariable UUID roleId,
                                           @AuthenticationPrincipal CustomUserDetails userDetails) {
        roleService.deleteRole(roleId, userDetails);
        return ResponseEntity.noContent().build();
    }
}
