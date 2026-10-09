package com.omnirest.omnirest_backend.controllers;

import com.omnirest.omnirest_backend.services.AreasService;
import com.omnirest.omnirest_backend.services.SecurityValidationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Areas de preparacion (Cocina, Parrilla, Barra, Postres, Empaque) y a cual
 * va cada categoria o platillo. Son del restaurante; se llega por la sucursal
 * para validar el acceso igual que en las demas pantallas.
 */
@RestController
@RequestMapping("/api/v1/branches/{branchId}/areas")
@RequiredArgsConstructor
public class AreasController {

    private final AreasService areas;
    private final SecurityValidationService seguridad;
    private final com.omnirest.omnirest_backend.repositories.UserRepository userRepository;

    /** El area fija de quien entra (Barra, Cocina…); null si puede elegir. */
    @GetMapping("/mia")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Map<String, UUID>> mia(@PathVariable UUID branchId,
            @org.springframework.security.core.annotation.AuthenticationPrincipal
            com.omnirest.omnirest_backend.security.CustomUserDetails usuario) {
        seguridad.validateUserAccessToBranch(branchId);
        UUID area = usuario == null ? null : userRepository.findById(usuario.id()).map(u -> u.getAreaId()).orElse(null);
        java.util.HashMap<String, UUID> r = new java.util.HashMap<>();
        r.put("areaId", area);
        return ResponseEntity.ok(r);
    }

    /** Las areas, para que cada tablet elija la suya. */
    @GetMapping
    @PreAuthorize("hasAnyAuthority('SUPER_ADMIN', 'KITCHEN_READ', 'CATALOG_READ', 'ORDERS_READ', 'TABLES_READ')")
    public ResponseEntity<List<AreasService.Area>> listar(@PathVariable UUID branchId) {
        seguridad.validateUserAccessToBranch(branchId);
        return ResponseEntity.ok(areas.areasDeSucursal(branchId));
    }

    @GetMapping("/asignacion")
    @PreAuthorize("hasAnyAuthority('SUPER_ADMIN', 'CATALOG_READ')")
    public ResponseEntity<AreasService.Asignacion> asignacion(@PathVariable UUID branchId) {
        seguridad.validateUserAccessToBranch(branchId);
        return ResponseEntity.ok(areas.asignacion(areas.restauranteDe(branchId)));
    }

    @PutMapping("/asignacion")
    @PreAuthorize("hasAnyAuthority('SUPER_ADMIN', 'CATALOG_UPDATE')")
    public ResponseEntity<Void> guardarAsignacion(@PathVariable UUID branchId, @RequestBody AreasService.GuardarAsignacion datos) {
        seguridad.validateUserAccessToBranch(branchId);
        areas.guardarAsignacion(areas.restauranteDe(branchId), datos);
        return ResponseEntity.noContent().build();
    }

    @PostMapping
    @PreAuthorize("hasAnyAuthority('SUPER_ADMIN', 'CATALOG_UPDATE')")
    public ResponseEntity<AreasService.Area> crear(@PathVariable UUID branchId, @RequestBody AreasService.GuardarArea datos) {
        seguridad.validateUserAccessToBranch(branchId);
        return ResponseEntity.ok(areas.crear(areas.restauranteDe(branchId), datos));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyAuthority('SUPER_ADMIN', 'CATALOG_UPDATE')")
    public ResponseEntity<AreasService.Area> renombrar(@PathVariable UUID branchId, @PathVariable UUID id,
                                                       @RequestBody AreasService.GuardarArea datos) {
        seguridad.validateUserAccessToBranch(branchId);
        return ResponseEntity.ok(areas.renombrar(areas.restauranteDe(branchId), id, datos));
    }

    @PatchMapping("/{id}/activa")
    @PreAuthorize("hasAnyAuthority('SUPER_ADMIN', 'CATALOG_UPDATE')")
    public ResponseEntity<AreasService.Area> activar(@PathVariable UUID branchId, @PathVariable UUID id,
                                                     @RequestBody Map<String, Boolean> cuerpo) {
        seguridad.validateUserAccessToBranch(branchId);
        return ResponseEntity.ok(areas.activar(areas.restauranteDe(branchId), id, Boolean.TRUE.equals(cuerpo.get("activa"))));
    }

    @PostMapping("/{id}/predeterminada")
    @PreAuthorize("hasAnyAuthority('SUPER_ADMIN', 'CATALOG_UPDATE')")
    public ResponseEntity<AreasService.Area> predeterminada(@PathVariable UUID branchId, @PathVariable UUID id) {
        seguridad.validateUserAccessToBranch(branchId);
        return ResponseEntity.ok(areas.hacerPredeterminada(areas.restauranteDe(branchId), id));
    }
}
