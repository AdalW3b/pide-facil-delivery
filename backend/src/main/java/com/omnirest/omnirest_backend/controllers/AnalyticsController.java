package com.omnirest.omnirest_backend.controllers;

import com.omnirest.omnirest_backend.dtos.AnalyticsSummaryDTO;
import com.omnirest.omnirest_backend.dtos.DailySalesDTO;
import com.omnirest.omnirest_backend.dtos.EmployeePerformanceDTO;
import com.omnirest.omnirest_backend.dtos.KdsEfficiencyDTO;
import com.omnirest.omnirest_backend.dtos.PeakHourDTO;
import com.omnirest.omnirest_backend.dtos.ProductPerformanceDTO;
import com.omnirest.omnirest_backend.dtos.TablePerformanceDTO;
import com.omnirest.omnirest_backend.dtos.TurnaroundTimeDTO;
import com.omnirest.omnirest_backend.security.CustomUserDetails;
import com.omnirest.omnirest_backend.domain.entities.Restaurant;
import com.omnirest.omnirest_backend.repositories.RestaurantRepository;
import com.omnirest.omnirest_backend.services.AnalyticsService;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/analytics")
@RequiredArgsConstructor
public class AnalyticsController {

    private final AnalyticsService analyticsService;
    private final RestaurantRepository restaurantRepository;

    @GetMapping("/summary")
    @PreAuthorize("hasAnyAuthority('SUPER_ADMIN', 'SYSTEM_ADMIN', 'BRANCH_MANAGER')")
    public ResponseEntity<AnalyticsSummaryDTO> getAnalyticsSummary(
            @RequestParam(required = false) UUID restaurantId,
            @RequestParam(required = false) UUID branchId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
            @AuthenticationPrincipal CustomUserDetails user) {
        UUID effRestId = getEffectiveRestaurantId(restaurantId, user);
        UUID effBranchId = getEffectiveBranchId(branchId, user);
        return ResponseEntity.ok(analyticsService.getAnalyticsSummary(effRestId, effBranchId, startDate, endDate));
    }

    @GetMapping("/kpis/today")
    @PreAuthorize("hasAnyAuthority('SUPER_ADMIN', 'SYSTEM_ADMIN', 'BRANCH_MANAGER')")
    public ResponseEntity<AnalyticsSummaryDTO> getTodayKpis(
            @RequestParam(required = false) UUID restaurantId,
            @RequestParam(required = false) UUID branchId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
            @AuthenticationPrincipal CustomUserDetails user) {
        UUID effRestId = getEffectiveRestaurantId(restaurantId, user);
        UUID effBranchId = getEffectiveBranchId(branchId, user);
        return ResponseEntity.ok(analyticsService.getAnalyticsSummary(effRestId, effBranchId, startDate, endDate));
    }

    @GetMapping("/sales/daily")
    @PreAuthorize("hasAnyAuthority('SUPER_ADMIN', 'SYSTEM_ADMIN', 'BRANCH_MANAGER')")
    public ResponseEntity<List<DailySalesDTO>> getDailySales(
            @RequestParam(required = false) UUID restaurantId,
            @RequestParam(required = false) UUID branchId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
            @AuthenticationPrincipal CustomUserDetails user) {
        UUID effRestId = getEffectiveRestaurantId(restaurantId, user);
        UUID effBranchId = getEffectiveBranchId(branchId, user);
        return ResponseEntity.ok(analyticsService.getDailySales(effRestId, effBranchId, startDate, endDate));
    }

    @GetMapping("/employees/performance")
    @PreAuthorize("hasAnyAuthority('SUPER_ADMIN', 'SYSTEM_ADMIN', 'BRANCH_MANAGER')")
    public ResponseEntity<List<EmployeePerformanceDTO>> getEmployeePerformance(
            @RequestParam(required = false) UUID restaurantId,
            @RequestParam(required = false) UUID branchId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
            @AuthenticationPrincipal CustomUserDetails user) {
        UUID effRestId = getEffectiveRestaurantId(restaurantId, user);
        UUID effBranchId = getEffectiveBranchId(branchId, user);
        return ResponseEntity.ok(analyticsService.getEmployeePerformance(effRestId, effBranchId, startDate, endDate));
    }

    @GetMapping("/tables/performance")
    @PreAuthorize("hasAnyAuthority('SUPER_ADMIN', 'SYSTEM_ADMIN', 'BRANCH_MANAGER')")
    public ResponseEntity<List<TablePerformanceDTO>> getTablePerformance(
            @RequestParam(required = false) UUID restaurantId,
            @RequestParam(required = false) UUID branchId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
            @AuthenticationPrincipal CustomUserDetails user) {
        UUID effRestId = getEffectiveRestaurantId(restaurantId, user);
        UUID effBranchId = getEffectiveBranchId(branchId, user);
        return ResponseEntity.ok(analyticsService.getTablePerformance(effRestId, effBranchId, startDate, endDate));
    }

    @GetMapping("/products/performance")
    @PreAuthorize("hasAnyAuthority('SUPER_ADMIN', 'SYSTEM_ADMIN', 'BRANCH_MANAGER')")
    public ResponseEntity<List<ProductPerformanceDTO>> getTopSellingProducts(
            @RequestParam(required = false) UUID restaurantId,
            @RequestParam(required = false) UUID branchId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
            @AuthenticationPrincipal CustomUserDetails user) {
        UUID effRestId = getEffectiveRestaurantId(restaurantId, user);
        UUID effBranchId = getEffectiveBranchId(branchId, user);
        return ResponseEntity.ok(analyticsService.getTopSellingProducts(effRestId, effBranchId, startDate, endDate));
    }

    @GetMapping("/tables/turnaround")
    @PreAuthorize("hasAnyAuthority('SUPER_ADMIN', 'SYSTEM_ADMIN', 'BRANCH_MANAGER')")
    public ResponseEntity<List<TurnaroundTimeDTO>> getTableTurnaround(
            @RequestParam(required = false) UUID restaurantId,
            @RequestParam(required = false) UUID branchId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
            @AuthenticationPrincipal CustomUserDetails user) {
        UUID effRestId = getEffectiveRestaurantId(restaurantId, user);
        UUID effBranchId = getEffectiveBranchId(branchId, user);
        return ResponseEntity.ok(analyticsService.getTableTurnaround(effRestId, effBranchId, startDate, endDate));
    }

    @GetMapping("/peak-hours")
    @PreAuthorize("hasAnyAuthority('SUPER_ADMIN', 'SYSTEM_ADMIN', 'BRANCH_MANAGER')")
    public ResponseEntity<List<PeakHourDTO>> getPeakHours(
            @RequestParam(required = false) UUID restaurantId,
            @RequestParam(required = false) UUID branchId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
            @AuthenticationPrincipal CustomUserDetails user) {
        UUID effRestId = getEffectiveRestaurantId(restaurantId, user);
        UUID effBranchId = getEffectiveBranchId(branchId, user);
        return ResponseEntity.ok(analyticsService.getPeakHours(effRestId, effBranchId, startDate, endDate));
    }

    @GetMapping("/kitchen/efficiency")
    @PreAuthorize("hasAnyAuthority('SUPER_ADMIN', 'SYSTEM_ADMIN', 'BRANCH_MANAGER')")
    public ResponseEntity<List<KdsEfficiencyDTO>> getKdsEfficiency(
            @RequestParam(required = false) UUID restaurantId,
            @RequestParam(required = false) UUID branchId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
            @AuthenticationPrincipal CustomUserDetails user) {
        UUID effRestId = getEffectiveRestaurantId(restaurantId, user);
        UUID effBranchId = getEffectiveBranchId(branchId, user);
        return ResponseEntity.ok(analyticsService.getKdsEfficiency(effRestId, effBranchId, startDate, endDate));
    }

    private UUID getEffectiveRestaurantId(UUID requestedId, CustomUserDetails user) {
        if ("SYSTEM_ADMIN".equalsIgnoreCase(user.roleName())) {
            return requestedId;
        }
        UUID targetId = (requestedId != null) ? requestedId : user.restaurantId();
        if (targetId == null) {
            return null;
        }
        boolean isDemo = restaurantRepository.findById(targetId)
                .map(r -> Boolean.TRUE.equals(r.getIsDemo()))
                .orElse(false);
        if (isDemo) {
            return restaurantRepository.findAll().stream()
                    .filter(r -> Boolean.TRUE.equals(r.getIsDemo()))
                    .map(Restaurant::getId)
                    .findFirst()
                    .orElse(targetId);
        }
        return targetId;
    }

    private UUID getEffectiveBranchId(UUID requestedId, CustomUserDetails user) {
        if ("SUPER_ADMIN".equalsIgnoreCase(user.roleName()) || "SYSTEM_ADMIN".equalsIgnoreCase(user.roleName())) {
            return requestedId;
        }
        boolean isDemo = user.restaurantId() != null && restaurantRepository.findById(user.restaurantId())
                .map(r -> Boolean.TRUE.equals(r.getIsDemo()))
                .orElse(false);
        if (isDemo) {
            return requestedId;
        }
        return user.branchId();
    }
}
