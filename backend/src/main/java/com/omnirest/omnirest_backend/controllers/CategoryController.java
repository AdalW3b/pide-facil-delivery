package com.omnirest.omnirest_backend.controllers;

import com.omnirest.omnirest_backend.dtos.CategoryRequestDTO;
import com.omnirest.omnirest_backend.dtos.CategoryResponseDTO;
import com.omnirest.omnirest_backend.security.CustomUserDetails;
import com.omnirest.omnirest_backend.services.CategoryService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/categories")
@RequiredArgsConstructor
public class CategoryController {

    private final CategoryService categoryService;

    @GetMapping
    @PreAuthorize("hasAuthority('CATALOG_READ')")
    public ResponseEntity<List<CategoryResponseDTO>> getCategories(@AuthenticationPrincipal CustomUserDetails userDetails) {
        return ResponseEntity.ok(categoryService.getCategories(userDetails));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('CATALOG_READ')")
    public ResponseEntity<CategoryResponseDTO> getCategoryById(
            @PathVariable UUID id,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        return ResponseEntity.ok(categoryService.getCategoryById(id, userDetails));
    }

    @PostMapping
    @PreAuthorize("hasAuthority('CATALOG_CREATE')")
    public ResponseEntity<CategoryResponseDTO> createCategory(
            @Valid @RequestBody CategoryRequestDTO request,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        return ResponseEntity.ok(categoryService.createCategory(request, userDetails));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('CATALOG_UPDATE')")
    public ResponseEntity<CategoryResponseDTO> updateCategory(
            @PathVariable UUID id,
            @Valid @RequestBody CategoryRequestDTO request,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        return ResponseEntity.ok(categoryService.updateCategory(id, request, userDetails));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('CATALOG_DELETE')")
    public ResponseEntity<Void> deleteCategory(
            @PathVariable UUID id,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        categoryService.deleteCategory(id, userDetails);
        return ResponseEntity.noContent().build();
    }
}
