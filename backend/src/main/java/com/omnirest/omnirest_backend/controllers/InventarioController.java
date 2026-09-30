package com.omnirest.omnirest_backend.controllers;

import com.omnirest.omnirest_backend.dtos.InventarioDTOs;
import com.omnirest.omnirest_backend.security.CustomUserDetails;
import com.omnirest.omnirest_backend.services.AgotadosService;
import com.omnirest.omnirest_backend.services.InventoryService;
import com.omnirest.omnirest_backend.services.MovimientosService;
import com.omnirest.omnirest_backend.services.SecurityValidationService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

/** Inventario de una sucursal: modo de control, movimientos e historial, y agotados. */
@RestController
@RequestMapping("/api/v1/branches/{branchId}")
@RequiredArgsConstructor
public class InventarioController {

    private final InventoryService inventoryService;
    private final MovimientosService movimientosService;
    private final AgotadosService agotadosService;
    private final SecurityValidationService securityValidationService;

    @GetMapping("/inventario/config")
    @PreAuthorize("hasAuthority('CATALOG_READ')")
    public ResponseEntity<InventarioDTOs.Config> config(@PathVariable UUID branchId) {
        securityValidationService.validateUserAccessToBranch(branchId);
        return ResponseEntity.ok(new InventarioDTOs.Config(inventoryService.modo(branchId)));
    }

    @PutMapping("/inventario/config")
    @PreAuthorize("hasAuthority('CATALOG_UPDATE')")
    public ResponseEntity<InventarioDTOs.Config> cambiarConfig(
            @PathVariable UUID branchId, @Valid @RequestBody InventarioDTOs.Config config) {
        securityValidationService.validateUserAccessToBranch(branchId);
        return ResponseEntity.ok(new InventarioDTOs.Config(inventoryService.cambiarModo(branchId, config.modo())));
    }

    /** Entrada de mercancia, merma o conteo fisico. */
    @PostMapping("/inventario/movimientos")
    @PreAuthorize("hasAuthority('CATALOG_UPDATE')")
    public ResponseEntity<InventarioDTOs.Resultado> registrar(
            @PathVariable UUID branchId, @Valid @RequestBody InventarioDTOs.NuevoMovimiento movimiento) {
        securityValidationService.validateUserAccessToBranch(branchId);
        return ResponseEntity.ok(movimientosService.registrar(branchId, movimiento));
    }

    /** Los ultimos 100 movimientos de un ingrediente o de un producto. */
    @GetMapping("/inventario/movimientos")
    @PreAuthorize("hasAuthority('CATALOG_READ')")
    public ResponseEntity<List<InventarioDTOs.Movimiento>> historial(
            @PathVariable UUID branchId,
            @RequestParam(required = false) UUID ingredientId,
            @RequestParam(required = false) UUID productId) {
        securityValidationService.validateUserAccessToBranch(branchId);
        if ((ingredientId == null) == (productId == null)) {
            throw new IllegalArgumentException("Indica un ingrediente o un producto.");
        }
        return ResponseEntity.ok(movimientosService.historial(branchId, ingredientId, productId));
    }

    // ------------------------------------------------------------------
    // Agotados ("se acabó")
    // ------------------------------------------------------------------

    /** Lo que no se puede pedir hoy: marcado a mano o sin existencias. */
    @GetMapping("/agotados")
    @PreAuthorize("hasAnyAuthority('CATALOG_READ', 'KITCHEN_READ', 'KITCHEN_UPDATE')")
    public ResponseEntity<List<AgotadosService.Agotado>> agotados(@PathVariable UUID branchId) {
        securityValidationService.validateUserAccessToBranch(branchId);
        return ResponseEntity.ok(agotadosService.lista(branchId));
    }

    @PostMapping("/products/{productId}/agotado")
    @PreAuthorize("hasAnyAuthority('CATALOG_UPDATE', 'KITCHEN_UPDATE')")
    public ResponseEntity<Void> marcarAgotado(
            @PathVariable UUID branchId, @PathVariable UUID productId,
            @AuthenticationPrincipal CustomUserDetails usuario) {
        securityValidationService.validateUserAccessToBranch(branchId);
        agotadosService.marcar(branchId, productId, usuario != null ? usuario.getUsername() : null);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/products/{productId}/agotado")
    @PreAuthorize("hasAnyAuthority('CATALOG_UPDATE', 'KITCHEN_UPDATE')")
    public ResponseEntity<Void> quitarAgotado(@PathVariable UUID branchId, @PathVariable UUID productId) {
        securityValidationService.validateUserAccessToBranch(branchId);
        agotadosService.quitar(branchId, productId);
        return ResponseEntity.noContent().build();
    }
}
