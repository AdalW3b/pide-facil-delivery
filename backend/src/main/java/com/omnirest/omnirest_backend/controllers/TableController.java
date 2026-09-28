package com.omnirest.omnirest_backend.controllers;

import com.omnirest.omnirest_backend.dtos.TableRequestDTO;
import com.omnirest.omnirest_backend.dtos.TableResponseDTO;
import com.omnirest.omnirest_backend.security.CustomUserDetails;
import com.omnirest.omnirest_backend.services.TableService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/tables")
@RequiredArgsConstructor
public class TableController {

    private final TableService tableService;

    @GetMapping
    @PreAuthorize("hasAuthority('TABLES_READ')")
    public ResponseEntity<List<TableResponseDTO>> getTables(
            @RequestParam(required = false) UUID branchId,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        return ResponseEntity.ok(tableService.getTables(userDetails, branchId));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('TABLES_READ')")
    public ResponseEntity<TableResponseDTO> getTableById(
            @PathVariable UUID id,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        return ResponseEntity.ok(tableService.getTableById(id, userDetails));
    }

    @PostMapping
    @PreAuthorize("hasAuthority('TABLES_CREATE')")
    public ResponseEntity<TableResponseDTO> createTable(
            @Valid @RequestBody TableRequestDTO request,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        return ResponseEntity.ok(tableService.createTable(request, userDetails));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('TABLES_UPDATE')")
    public ResponseEntity<TableResponseDTO> updateTable(
            @PathVariable UUID id,
            @Valid @RequestBody TableRequestDTO request,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        return ResponseEntity.ok(tableService.updateTable(id, request, userDetails));
    }

    @PutMapping("/{tableId}/waiters")
    @PreAuthorize("hasAuthority('TABLES_UPDATE')")
    public ResponseEntity<TableResponseDTO> assignWaiters(
            @PathVariable UUID tableId,
            @RequestBody List<UUID> waiterIds,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        return ResponseEntity.ok(tableService.assignWaitersToTable(tableId, waiterIds, userDetails));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('TABLES_DELETE')")
    public ResponseEntity<Void> deleteTable(
            @PathVariable UUID id,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        tableService.deleteTable(id, userDetails);
        return ResponseEntity.noContent().build();
    }
}
