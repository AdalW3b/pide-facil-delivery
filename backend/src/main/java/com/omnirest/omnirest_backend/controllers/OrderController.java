package com.omnirest.omnirest_backend.controllers;

import com.omnirest.omnirest_backend.dtos.AddItemsRequestDTO;
import com.omnirest.omnirest_backend.dtos.BillSummaryDTO;
import com.omnirest.omnirest_backend.dtos.OrderResponseDTO;
import com.omnirest.omnirest_backend.services.OrderService;
import com.omnirest.omnirest_backend.services.SecurityValidationService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/branches")
@RequiredArgsConstructor
public class OrderController {
    private final OrderService orderService;
    private final SecurityValidationService securityValidationService;

    @PatchMapping("/{branchId}/orders/{orderId}/cancel")
    @PreAuthorize("hasAuthority('ORDERS_DELETE') or hasAuthority('TABLES_UPDATE')")
    public ResponseEntity<OrderResponseDTO> cancelOrder(
            @PathVariable UUID branchId,
            @PathVariable UUID orderId) {
        securityValidationService.validateUserAccessToBranch(branchId);
        return ResponseEntity.ok(orderService.cancelOrder(branchId, orderId));
    }

    @GetMapping("/{branchId}/orders/history")
    @PreAuthorize("hasAuthority('ORDERS_READ') or hasAuthority('TABLES_READ')")
    public ResponseEntity<Page<OrderResponseDTO>> getOrderHistory(
            @PathVariable UUID branchId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        securityValidationService.validateUserAccessToBranch(branchId);
        return ResponseEntity.ok(orderService.getOrderHistory(branchId, page, size));
    }

    // --- NUEVOS ENDPOINTS SEGUROS MIGRADOS DESDE WEBHOOKS ---
    @PostMapping("/{branchId}/tables/{tableNumber}/open")
    @PreAuthorize("hasAnyAuthority('ORDERS_CREATE', 'TABLES_UPDATE')")
    public ResponseEntity<OrderResponseDTO> openOrder(@PathVariable UUID branchId, @PathVariable Integer tableNumber) {
        securityValidationService.validateUserAccessToBranch(branchId);
        return ResponseEntity.ok(orderService.openOrder(branchId, tableNumber));
    }

    @PostMapping("/{branchId}/orders/{orderId}/items")
    @PreAuthorize("hasAnyAuthority('ORDERS_CREATE', 'TABLES_UPDATE')")
    public ResponseEntity<OrderResponseDTO> addItems(@PathVariable UUID branchId, @PathVariable UUID orderId, @Valid @RequestBody AddItemsRequestDTO request) {
        securityValidationService.validateUserAccessToBranch(branchId);
        return ResponseEntity.ok(orderService.addItems(branchId, orderId, request.items()));
    }

    @GetMapping("/{branchId}/orders/{orderId}/bill")
    @PreAuthorize("hasAnyAuthority('ORDERS_READ', 'TABLES_READ')")
    public ResponseEntity<BillSummaryDTO> getBill(@PathVariable UUID branchId, @PathVariable UUID orderId) {
        securityValidationService.validateUserAccessToBranch(branchId);
        return ResponseEntity.ok(orderService.getBill(branchId, orderId));
    }

    /** El mesero le manda la cuenta al cliente por WhatsApp. */
    @PostMapping("/{branchId}/orders/{orderId}/enviar-cuenta")
    @PreAuthorize("hasAnyAuthority('ORDERS_READ', 'TABLES_READ')")
    public ResponseEntity<BillSummaryDTO> enviarCuenta(
            @PathVariable UUID branchId,
            @PathVariable UUID orderId,
            @RequestBody(required = false) java.util.Map<String, String> cuerpo) {
        securityValidationService.validateUserAccessToBranch(branchId);
        return ResponseEntity.ok(orderService.enviarCuenta(branchId, orderId, cuerpo != null ? cuerpo.get("telefono") : null));
    }

    @PostMapping("/{branchId}/orders/{orderId}/close")
    @PreAuthorize("hasAnyAuthority('ORDERS_UPDATE', 'TABLES_UPDATE')")
    public ResponseEntity<OrderResponseDTO> closeOrder(@PathVariable UUID branchId, @PathVariable UUID orderId) {
        securityValidationService.validateUserAccessToBranch(branchId);
        return ResponseEntity.ok(orderService.closeOrder(branchId, orderId));
    }
}
