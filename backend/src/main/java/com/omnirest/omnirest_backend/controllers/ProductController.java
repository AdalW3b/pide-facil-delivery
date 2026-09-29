package com.omnirest.omnirest_backend.controllers;

import com.omnirest.omnirest_backend.dtos.ProductRequestDTO;
import com.omnirest.omnirest_backend.dtos.ProductResponseDTO;
import com.omnirest.omnirest_backend.security.CustomUserDetails;
import com.omnirest.omnirest_backend.services.InventoryService;
import com.omnirest.omnirest_backend.services.ProductService;
import com.omnirest.omnirest_backend.services.SecurityValidationService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/products")
@RequiredArgsConstructor
public class ProductController {

    private final ProductService productService;
    private final InventoryService inventoryService;
    private final SecurityValidationService securityValidationService;

    @GetMapping
    @PreAuthorize("hasAuthority('CATALOG_READ')")
    public ResponseEntity<List<ProductResponseDTO>> getProducts(
            @RequestParam(required = false) UUID branchId,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        if (branchId != null) securityValidationService.validateUserAccessToBranch(branchId);
        return ResponseEntity.ok(productService.getProducts(userDetails, branchId));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('CATALOG_READ')")
    public ResponseEntity<ProductResponseDTO> getProductById(
            @PathVariable UUID id,
            @RequestParam(required = false) UUID branchId,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        return ResponseEntity.ok(productService.getProductById(id, userDetails, branchId));
    }

    @PostMapping
    @PreAuthorize("hasAuthority('CATALOG_CREATE')")
    public ResponseEntity<ProductResponseDTO> createProduct(
            @Valid @RequestBody ProductRequestDTO request,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        return ResponseEntity.ok(productService.createProduct(request, userDetails));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('CATALOG_UPDATE')")
    public ResponseEntity<ProductResponseDTO> updateProduct(
            @PathVariable UUID id,
            @Valid @RequestBody ProductRequestDTO request,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        return ResponseEntity.ok(productService.updateProduct(id, request, userDetails));
    }

    @PatchMapping("/{id}/stock")
    @PreAuthorize("hasAuthority('CATALOG_UPDATE')")
    public ResponseEntity<ProductResponseDTO> updateStock(
            @PathVariable UUID id,
            @RequestParam UUID branchId,
            @RequestBody Map<String, Object> payload,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        securityValidationService.validateUserAccessToBranch(branchId);
        // updateStock comprueba que el producto sea del restaurante de quien ajusta.
        return ResponseEntity.ok(productService.updateStock(id, branchId, extractStock(payload), userDetails));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('CATALOG_DELETE')")
    public ResponseEntity<Void> deleteProduct(
            @PathVariable UUID id,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        productService.deleteProduct(id, userDetails);
        return ResponseEntity.noContent().build();
    }

    private Integer extractStock(Map<String, Object> payload) {
        if (payload == null || payload.isEmpty()) {
            return 0;
        }
        Object val = payload.get("stock");
        if (val == null) {
            val = payload.get("newStock");
        }
        if (val == null) {
            val = payload.values().stream().filter(Objects::nonNull).findFirst().orElse(0);
        }
        return Integer.valueOf(val.toString());
    }
}
