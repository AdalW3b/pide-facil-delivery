package com.omnirest.omnirest_backend.controllers;

import com.omnirest.omnirest_backend.dtos.GrupoAdicionalDTO;
import com.omnirest.omnirest_backend.security.CustomUserDetails;
import com.omnirest.omnirest_backend.services.AdicionalesService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

/** Grupos de adicionales del restaurante. Son parte del catalogo y usan sus permisos. */
@RestController
@RequestMapping("/api/v1/adicionales")
@RequiredArgsConstructor
public class AdicionalesController {

    private final AdicionalesService adicionalesService;

    @GetMapping
    @PreAuthorize("hasAuthority('CATALOG_READ')")
    public ResponseEntity<List<GrupoAdicionalDTO>> listar(@AuthenticationPrincipal CustomUserDetails user) {
        return ResponseEntity.ok(adicionalesService.listar(user));
    }

    @PostMapping
    @PreAuthorize("hasAuthority('CATALOG_CREATE')")
    public ResponseEntity<GrupoAdicionalDTO> crear(
            @Valid @RequestBody GrupoAdicionalDTO request,
            @AuthenticationPrincipal CustomUserDetails user) {
        return ResponseEntity.ok(adicionalesService.crear(request, user));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('CATALOG_UPDATE')")
    public ResponseEntity<GrupoAdicionalDTO> actualizar(
            @PathVariable UUID id,
            @Valid @RequestBody GrupoAdicionalDTO request,
            @AuthenticationPrincipal CustomUserDetails user) {
        return ResponseEntity.ok(adicionalesService.actualizar(id, request, user));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('CATALOG_DELETE')")
    public ResponseEntity<Void> eliminar(
            @PathVariable UUID id,
            @AuthenticationPrincipal CustomUserDetails user) {
        adicionalesService.eliminar(id, user);
        return ResponseEntity.noContent().build();
    }
}
