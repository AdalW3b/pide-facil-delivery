package com.omnirest.omnirest_backend.controllers;

import com.omnirest.omnirest_backend.domain.entities.Restaurant;
import com.omnirest.omnirest_backend.dtos.AnalyticsSummaryDTO;
import com.omnirest.omnirest_backend.dtos.CanalVentasDTO;
import com.omnirest.omnirest_backend.dtos.DailySalesDTO;
import com.omnirest.omnirest_backend.dtos.EmployeePerformanceDTO;
import com.omnirest.omnirest_backend.dtos.KdsEfficiencyDTO;
import com.omnirest.omnirest_backend.dtos.PeakHourDTO;
import com.omnirest.omnirest_backend.dtos.ProductPerformanceDTO;
import com.omnirest.omnirest_backend.dtos.TablePerformanceDTO;
import com.omnirest.omnirest_backend.dtos.TurnaroundTimeDTO;
import com.omnirest.omnirest_backend.repositories.BranchRepository;
import com.omnirest.omnirest_backend.repositories.RestaurantRepository;
import com.omnirest.omnirest_backend.security.CustomUserDetails;
import com.omnirest.omnirest_backend.services.AnalyticsService;
import com.omnirest.omnirest_backend.services.SecurityValidationService;
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
@PreAuthorize("hasAnyAuthority('SUPER_ADMIN', 'SYSTEM_ADMIN', 'BRANCH_MANAGER')")
public class AnalyticsController {

    private final AnalyticsService analyticsService;
    private final com.omnirest.omnirest_backend.services.FlujoService flujoService;
    private final RestaurantRepository restaurantRepository;
    private final BranchRepository branchRepository;
    private final SecurityValidationService securityValidationService;

    @GetMapping({"/summary", "/kpis/today"})
    public ResponseEntity<AnalyticsSummaryDTO> getAnalyticsSummary(
            @RequestParam(required = false) UUID restaurantId,
            @RequestParam(required = false) UUID branchId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
            @AuthenticationPrincipal CustomUserDetails user) {
        Alcance a = alcance(restaurantId, branchId, user);
        return ResponseEntity.ok(analyticsService.getAnalyticsSummary(a.restaurantId(), a.branchId(), startDate, endDate));
    }

    /** Ingresos y egresos: lo cobrado contra compras, pagos a proveedores y salidas de caja. */
    @GetMapping("/flujo")
    public ResponseEntity<com.omnirest.omnirest_backend.dtos.FlujoDTOs.Flujo> getFlujo(
            @RequestParam(required = false) UUID restaurantId,
            @RequestParam(required = false) UUID branchId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
            @AuthenticationPrincipal CustomUserDetails user) {
        Alcance a = alcance(restaurantId, branchId, user);
        return ResponseEntity.ok(flujoService.flujo(a.restaurantId(), a.branchId(), startDate, endDate));
    }

    @GetMapping("/sales/daily")
    public ResponseEntity<List<DailySalesDTO>> getDailySales(
            @RequestParam(required = false) UUID restaurantId,
            @RequestParam(required = false) UUID branchId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
            @AuthenticationPrincipal CustomUserDetails user) {
        Alcance a = alcance(restaurantId, branchId, user);
        return ResponseEntity.ok(analyticsService.getDailySales(a.restaurantId(), a.branchId(), startDate, endDate));
    }

    @GetMapping("/sales/channels")
    public ResponseEntity<List<CanalVentasDTO>> getVentasPorCanal(
            @RequestParam(required = false) UUID restaurantId,
            @RequestParam(required = false) UUID branchId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
            @AuthenticationPrincipal CustomUserDetails user) {
        Alcance a = alcance(restaurantId, branchId, user);
        return ResponseEntity.ok(analyticsService.getVentasPorCanal(a.restaurantId(), a.branchId(), startDate, endDate));
    }

    @GetMapping("/employees/performance")
    public ResponseEntity<List<EmployeePerformanceDTO>> getEmployeePerformance(
            @RequestParam(required = false) UUID restaurantId,
            @RequestParam(required = false) UUID branchId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
            @AuthenticationPrincipal CustomUserDetails user) {
        Alcance a = alcance(restaurantId, branchId, user);
        return ResponseEntity.ok(analyticsService.getEmployeePerformance(a.restaurantId(), a.branchId(), startDate, endDate));
    }

    @GetMapping("/tables/performance")
    public ResponseEntity<List<TablePerformanceDTO>> getTablePerformance(
            @RequestParam(required = false) UUID restaurantId,
            @RequestParam(required = false) UUID branchId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
            @AuthenticationPrincipal CustomUserDetails user) {
        Alcance a = alcance(restaurantId, branchId, user);
        return ResponseEntity.ok(analyticsService.getTablePerformance(a.restaurantId(), a.branchId(), startDate, endDate));
    }

    /** Los mas vendidos con costo y margen. limit: 10 para el tablero, hasta 500 para exportar. */
    @GetMapping("/products/performance")
    public ResponseEntity<List<ProductPerformanceDTO>> getTopSellingProducts(
            @RequestParam(required = false) UUID restaurantId,
            @RequestParam(required = false) UUID branchId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
            @RequestParam(defaultValue = "10") int limit,
            @AuthenticationPrincipal CustomUserDetails user) {
        Alcance a = alcance(restaurantId, branchId, user);
        int limite = Math.max(1, Math.min(limit, 500));
        return ResponseEntity.ok(analyticsService.getTopSellingProducts(a.restaurantId(), a.branchId(), startDate, endDate, limite));
    }

    @GetMapping("/tables/turnaround")
    public ResponseEntity<List<TurnaroundTimeDTO>> getTableTurnaround(
            @RequestParam(required = false) UUID restaurantId,
            @RequestParam(required = false) UUID branchId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
            @AuthenticationPrincipal CustomUserDetails user) {
        Alcance a = alcance(restaurantId, branchId, user);
        return ResponseEntity.ok(analyticsService.getTableTurnaround(a.restaurantId(), a.branchId(), startDate, endDate));
    }

    @GetMapping("/peak-hours")
    public ResponseEntity<List<PeakHourDTO>> getPeakHours(
            @RequestParam(required = false) UUID restaurantId,
            @RequestParam(required = false) UUID branchId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
            @AuthenticationPrincipal CustomUserDetails user) {
        Alcance a = alcance(restaurantId, branchId, user);
        return ResponseEntity.ok(analyticsService.getPeakHours(a.restaurantId(), a.branchId(), startDate, endDate));
    }

    @GetMapping("/kitchen/efficiency")
    public ResponseEntity<List<KdsEfficiencyDTO>> getKdsEfficiency(
            @RequestParam(required = false) UUID restaurantId,
            @RequestParam(required = false) UUID branchId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
            @AuthenticationPrincipal CustomUserDetails user) {
        Alcance a = alcance(restaurantId, branchId, user);
        return ResponseEntity.ok(analyticsService.getKdsEfficiency(a.restaurantId(), a.branchId(), startDate, endDate));
    }

    /** De que restaurante y sucursal sale el reporte. */
    record Alcance(UUID restaurantId, UUID branchId) {
    }

    /**
     * Solo SYSTEM_ADMIN elige cualquier restaurante. Los demas ven siempre el
     * suyo: antes bastaba mandar otro restaurantId para leer las ventas de un
     * restaurante ajeno. La sucursal pedida se valida (el gerente solo la
     * suya) y el restaurante se toma de ella.
     */
    Alcance alcance(UUID restaurantId, UUID branchId, CustomUserDetails user) {
        if ("SYSTEM_ADMIN".equalsIgnoreCase(user.roleName())) {
            return new Alcance(restaurantId, branchId);
        }
        if (branchId != null) {
            securityValidationService.validateUserAccessToBranch(branchId);
            UUID deLaSucursal = branchRepository.findById(branchId)
                    .map(b -> b.getRestaurant().getId())
                    .orElseThrow(() -> new IllegalArgumentException("Esa sucursal no existe."));
            return new Alcance(deLaSucursal, branchId);
        }
        if ("BRANCH_MANAGER".equalsIgnoreCase(user.roleName())) {
            if (user.branchId() == null) throw new AccessDeniedException("No tienes una sucursal asignada.");
            return alcance(null, user.branchId(), user);
        }
        UUID propio = restauranteDe(user);
        if (propio == null) throw new AccessDeniedException("No tienes un restaurante asignado.");
        return new Alcance(propio, null);
    }

    /** El restaurante del usuario; los usuarios demo comparten el restaurante demo con datos. */
    private UUID restauranteDe(CustomUserDetails user) {
        UUID propio = user.restaurantId();
        if (propio == null) return null;
        boolean esDemo = restaurantRepository.findById(propio)
                .map(r -> Boolean.TRUE.equals(r.getIsDemo()))
                .orElse(false);
        if (!esDemo) return propio;
        return restaurantRepository.findAll().stream()
                .filter(r -> Boolean.TRUE.equals(r.getIsDemo()))
                .map(Restaurant::getId)
                .findFirst()
                .orElse(propio);
    }
}
