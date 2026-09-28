package com.omnirest.omnirest_backend.controllers;

import com.omnirest.omnirest_backend.dtos.IngredientDTO;
import com.omnirest.omnirest_backend.security.CustomUserDetails;
import com.omnirest.omnirest_backend.services.IngredientService;
import com.omnirest.omnirest_backend.services.InventoryService;
import com.omnirest.omnirest_backend.services.SecurityValidationService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/ingredients")
@RequiredArgsConstructor
public class IngredientController {

    private final IngredientService ingredientService;
    private final InventoryService inventoryService;
    private final SecurityValidationService securityValidationService;

    @GetMapping
    @PreAuthorize("hasAuthority('CATALOG_READ')")
    public ResponseEntity<List<IngredientDTO>> getIngredients(
            @RequestParam(required = false) UUID branchId,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        return ResponseEntity.ok(ingredientService.getIngredients(userDetails, branchId));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('CATALOG_READ')")
    public ResponseEntity<IngredientDTO> getIngredientById(
            @PathVariable UUID id,
            @RequestParam(required = false) UUID branchId,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        return ResponseEntity.ok(ingredientService.getIngredientById(id, userDetails, branchId));
    }

    @PostMapping
    @PreAuthorize("hasAuthority('CATALOG_CREATE')")
    public ResponseEntity<IngredientDTO> createIngredient(
            @Valid @RequestBody IngredientDTO request,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        return ResponseEntity.ok(ingredientService.createIngredient(request, userDetails));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('CATALOG_UPDATE')")
    public ResponseEntity<IngredientDTO> updateIngredient(
            @PathVariable UUID id,
            @Valid @RequestBody IngredientDTO request,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        return ResponseEntity.ok(ingredientService.updateIngredient(id, request, userDetails));
    }

    @PatchMapping("/{id}/stock")
    @PreAuthorize("hasAuthority('CATALOG_UPDATE')")
    public ResponseEntity<IngredientDTO> updateStock(
            @PathVariable UUID id,
            @RequestParam UUID branchId,
            @RequestBody Map<String, Object> payload,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        securityValidationService.validateUserAccessToBranch(branchId);
        BigDecimal newStock = extractStock(payload);
        inventoryService.setAbsoluteStock(id, branchId, newStock, true);
        return ResponseEntity.ok(ingredientService.getIngredientById(id, userDetails, branchId));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('CATALOG_DELETE')")
    public ResponseEntity<Void> deleteIngredient(
            @PathVariable UUID id,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        ingredientService.deleteIngredient(id, userDetails);
        return ResponseEntity.noContent().build();
    }

    private BigDecimal extractStock(Map<String, Object> payload) {
        if (payload == null || payload.isEmpty()) {
            return BigDecimal.ZERO;
        }
        Object val = payload.get("stock");
        if (val == null) {
            val = payload.get("newStock");
        }
        if (val == null) {
            val = payload.values().stream().filter(Objects::nonNull).findFirst().orElse(BigDecimal.ZERO);
        }
        return new BigDecimal(val.toString());
    }
}
