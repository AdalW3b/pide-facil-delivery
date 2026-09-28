package com.omnirest.omnirest_backend.controllers;

import com.omnirest.omnirest_backend.dtos.CreateUserDTO;
import com.omnirest.omnirest_backend.dtos.UpdateUserDTO;
import com.omnirest.omnirest_backend.dtos.UserResponseDTO;
import com.omnirest.omnirest_backend.security.CustomUserDetails;
import com.omnirest.omnirest_backend.services.UserService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/admin/users")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    @GetMapping
    @PreAuthorize("hasAuthority('USERS_READ')")
    public ResponseEntity<List<UserResponseDTO>> listUsers(@AuthenticationPrincipal CustomUserDetails userDetails) {
        return ResponseEntity.ok(userService.listUsers(userDetails));
    }

    @PostMapping
    @PreAuthorize("hasAuthority('USERS_CREATE')")
    public ResponseEntity<UserResponseDTO> createUser(
            @Valid @RequestBody CreateUserDTO request,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        return ResponseEntity.ok(userService.createUser(request, userDetails));
    }

    @PutMapping("/{userId}")
    @PreAuthorize("hasAuthority('USERS_UPDATE')")
    public ResponseEntity<UserResponseDTO> updateUser(
            @PathVariable UUID userId,
            @Valid @RequestBody UpdateUserDTO request,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        return ResponseEntity.ok(userService.updateUser(userId, request, userDetails));
    }

    @DeleteMapping("/{userId}")
    @PreAuthorize("hasAuthority('USERS_DELETE')")
    public ResponseEntity<Void> deleteUser(
            @PathVariable UUID userId,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        userService.deleteUser(userId, userDetails);
        return ResponseEntity.noContent().build();
    }
}
