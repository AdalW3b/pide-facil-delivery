package com.omnirest.omnirest_backend.controllers;

import com.omnirest.omnirest_backend.dtos.BranchRequestDTO;
import com.omnirest.omnirest_backend.dtos.BranchResponseDTO;
import com.omnirest.omnirest_backend.dtos.BulkTableRequestDTO;
import com.omnirest.omnirest_backend.dtos.BulkTableResponseDTO;
import com.omnirest.omnirest_backend.dtos.CreateTableRequestDTO;
import com.omnirest.omnirest_backend.dtos.TableResponseDTO;
import com.omnirest.omnirest_backend.domain.entities.Restaurant;
import com.omnirest.omnirest_backend.repositories.BranchRepository;
import com.omnirest.omnirest_backend.repositories.RestaurantRepository;
import com.omnirest.omnirest_backend.security.CustomUserDetails;
import com.omnirest.omnirest_backend.services.AdminService;
import com.omnirest.omnirest_backend.services.SecurityValidationService;
import com.omnirest.omnirest_backend.services.TableService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/v1/branches")
@RequiredArgsConstructor
public class BranchController {

    private final BranchRepository branchRepository;
    private final TableService tableService;
    private final RestaurantRepository restaurantRepository;
    private final AdminService adminService;
    private final SecurityValidationService securityValidationService;

    @GetMapping
    @PreAuthorize("hasAuthority('BRANCH_READ')")
    @Transactional(readOnly = true)
    public ResponseEntity<List<BranchResponseDTO>> getBranches(
            @AuthenticationPrincipal CustomUserDetails userDetails) {

        UUID restaurantId = userDetails.restaurantId();
        if (restaurantId == null) {
            throw new IllegalArgumentException("Usuario debe estar asociado a un restaurante.");
        }

        boolean isDemo = restaurantRepository.findById(restaurantId)
                .map(r -> Boolean.TRUE.equals(r.getIsDemo()))
                .orElse(false);
        if (isDemo) {
            restaurantId = restaurantRepository.findAll().stream()
                    .filter(r -> Boolean.TRUE.equals(r.getIsDemo()))
                    .map(Restaurant::getId)
                    .findFirst()
                    .orElse(restaurantId);
        }

        List<BranchResponseDTO> list = branchRepository.findByRestaurantId(restaurantId).stream()
                .map(branch -> new BranchResponseDTO(
                        branch.getId(),
                        branch.getRestaurant().getId(),
                        branch.getRestaurant().getName(),
                        branch.getName(),
                        branch.getAddress(),
                        branch.getWhatsappNumber(),
                        branch.getN8nWebhookUrl(),
                        branch.getActive(),
                        branch.getCreatedAt()))
                .collect(Collectors.toList());

        return ResponseEntity.ok(list);
    }

    @PutMapping("/{branchId}")
    @PreAuthorize("hasAnyAuthority('SUPER_ADMIN', 'SYSTEM_ADMIN', 'BRANCH_UPDATE')")
    public ResponseEntity<BranchResponseDTO> updateBranch(
            @PathVariable UUID branchId,
            @RequestBody BranchRequestDTO request) {
        securityValidationService.validateUserAccessToBranch(branchId);
        return ResponseEntity.ok(adminService.updateBranch(branchId, request));
    }

    @PostMapping("/{branchId}/tables")
    @PreAuthorize("hasAuthority('TABLES_CREATE')")
    public ResponseEntity<TableResponseDTO> createTable(
            @PathVariable UUID branchId,
            @Valid @RequestBody CreateTableRequestDTO request,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        TableResponseDTO response = tableService.createTableForBranch(branchId, request, userDetails);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @PostMapping("/{branchId}/tables/bulk")
    @PreAuthorize("hasAuthority('TABLES_CREATE')")
    public ResponseEntity<BulkTableResponseDTO> bulkCreateTable(
            @PathVariable UUID branchId,
            @Valid @RequestBody BulkTableRequestDTO request,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        BulkTableResponseDTO response = tableService.bulkCreateTables(branchId, request, userDetails);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    /**
     * Nombre de la sucursal y de su restaurante, para la barra superior del
     * panel. Lo puede pedir cualquiera que trabaje en ella, sin BRANCH_READ.
     */
    @GetMapping("/{branchId}/nombre")
    @PreAuthorize("isAuthenticated()")
    @Transactional(readOnly = true)
    public ResponseEntity<java.util.Map<String, String>> getNombre(@PathVariable UUID branchId) {
        securityValidationService.validateUserAccessToBranch(branchId);
        com.omnirest.omnirest_backend.domain.entities.Branch branch = branchRepository.findById(branchId)
                .orElseThrow(() -> new IllegalArgumentException("Sucursal no encontrada"));
        return ResponseEntity.ok(java.util.Map.of(
                "sucursal", branch.getName(),
                "restaurante", branch.getRestaurant().getName()));
    }

    @GetMapping("/{branchId}/bot-config")
    @PreAuthorize("hasAnyAuthority('SUPER_ADMIN', 'SYSTEM_ADMIN', 'BRANCH_MANAGER')")
    public ResponseEntity<com.omnirest.omnirest_backend.dtos.BotConfigDTO> getBotConfig(
            @PathVariable UUID branchId) {

        com.omnirest.omnirest_backend.domain.entities.Branch branch = branchRepository.findById(branchId)
                .orElseThrow(() -> new IllegalArgumentException("Sucursal no encontrada"));

        return ResponseEntity.ok(new com.omnirest.omnirest_backend.dtos.BotConfigDTO(
                branch.getBotName() != null ? branch.getBotName() : "OmniBot",
                branch.getBotTone() != null ? branch.getBotTone() : "Amable, servicial y conciso"));
    }

    @PutMapping("/{branchId}/bot-config")
    @PreAuthorize("hasAnyAuthority('SUPER_ADMIN', 'SYSTEM_ADMIN', 'BRANCH_MANAGER')")
    public ResponseEntity<com.omnirest.omnirest_backend.dtos.BotConfigDTO> updateBotConfig(
            @PathVariable UUID branchId,
            @RequestBody com.omnirest.omnirest_backend.dtos.BotConfigDTO dto) {

        com.omnirest.omnirest_backend.domain.entities.Branch branch = branchRepository.findById(branchId)
                .orElseThrow(() -> new IllegalArgumentException("Sucursal no encontrada"));

        branch.setBotName(dto.botName());
        branch.setBotTone(dto.botTone());
        branchRepository.save(branch);

        return ResponseEntity.ok(dto);
    }
}
