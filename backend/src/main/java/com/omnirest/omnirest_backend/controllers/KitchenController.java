package com.omnirest.omnirest_backend.controllers;

import com.omnirest.omnirest_backend.domain.enums.KitchenStatus;
import com.omnirest.omnirest_backend.dtos.KitchenTicketDTO;
import com.omnirest.omnirest_backend.services.OrderService;
import com.omnirest.omnirest_backend.services.SecurityValidationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequiredArgsConstructor
public class KitchenController {

    private final OrderService orderService;
    private final com.omnirest.omnirest_backend.services.DeliveryService deliveryService;
    private final SecurityValidationService securityValidationService;

    @GetMapping("/api/v1/branches/{branchId}/kitchen/tickets")
    @PreAuthorize("hasAuthority('KITCHEN_READ')")
    public ResponseEntity<List<KitchenTicketDTO>> getKitchenTickets(@PathVariable UUID branchId) {
        securityValidationService.validateUserAccessToBranch(branchId);
        return ResponseEntity.ok(orderService.getKitchenTickets(branchId));
    }

    @PatchMapping("/api/v1/branches/{branchId}/kitchen/items/{itemId}/status")
    @PreAuthorize("hasAuthority('KITCHEN_UPDATE')")
    public ResponseEntity<Void> updateKitchenStatus(
            @PathVariable UUID branchId,
            @PathVariable UUID itemId,
            @RequestParam("status") KitchenStatus status) {
        securityValidationService.validateUserAccessToBranch(branchId);
        orderService.updateKitchenStatus(branchId, itemId, status);
        return ResponseEntity.ok().build();
    }

    /**
     * Toda la comanda de un toque: los platillos que estan en {@code desde}
     * pasan a {@code a} (por ejemplo, PENDING,PREPARING -> READY).
     */
    /**
     * Empaque: con todas las areas listas, el pedido para llevar o a domicilio
     * queda empacado. Con el permiso de cocina, sin poder tocar lo demas del
     * pedido a domicilio.
     */
    @PostMapping("/api/v1/branches/{branchId}/kitchen/orders/{orderId}/empacar")
    @PreAuthorize("hasAuthority('KITCHEN_UPDATE')")
    public ResponseEntity<Void> empacar(@PathVariable UUID branchId, @PathVariable UUID orderId) {
        securityValidationService.validateUserAccessToBranch(branchId);
        deliveryService.cambiarEstado(branchId, orderId, new com.omnirest.omnirest_backend.dtos.CambiarEstadoEntregaDTO(
                com.omnirest.omnirest_backend.domain.enums.DeliveryStatus.LISTO, null));
        return ResponseEntity.noContent().build();
    }

    @PatchMapping("/api/v1/branches/{branchId}/kitchen/orders/{orderId}/status")
    @PreAuthorize("hasAuthority('KITCHEN_UPDATE')")
    public ResponseEntity<java.util.Map<String, Integer>> cambiarComanda(
            @PathVariable UUID branchId,
            @PathVariable UUID orderId,
            @RequestParam("desde") java.util.Set<KitchenStatus> desde,
            @RequestParam("a") KitchenStatus a,
            @RequestParam(value = "area", required = false) UUID area) {
        securityValidationService.validateUserAccessToBranch(branchId);
        return ResponseEntity.ok(java.util.Map.of("cambiaron", orderService.cambiarEstadoDeComanda(branchId, orderId, desde, a, area)));
    }
}
