package com.omnirest.omnirest_backend.controllers;

import com.omnirest.omnirest_backend.dtos.PaymentMethodDTO;
import com.omnirest.omnirest_backend.services.PaymentMethodService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/branches/{branchId}/payment-methods")
@RequiredArgsConstructor
public class PaymentMethodController {

    private final PaymentMethodService paymentMethodService;

    @GetMapping
    public ResponseEntity<List<PaymentMethodDTO>> getPaymentMethods(@PathVariable UUID branchId) {
        return ResponseEntity.ok(paymentMethodService.getPaymentMethodsByBranchId(branchId));
    }

    @PostMapping
    public ResponseEntity<PaymentMethodDTO> createPaymentMethod(
            @PathVariable UUID branchId,
            @Valid @RequestBody PaymentMethodDTO request) {
        return ResponseEntity.ok(paymentMethodService.createPaymentMethod(branchId, request));
    }

    @PutMapping("/{id}")
    public ResponseEntity<PaymentMethodDTO> updatePaymentMethod(
            @PathVariable UUID branchId,
            @PathVariable UUID id,
            @Valid @RequestBody PaymentMethodDTO request) {
        return ResponseEntity.ok(paymentMethodService.updatePaymentMethod(branchId, id, request));
    }

    @PatchMapping("/{id}/toggle")
    public ResponseEntity<PaymentMethodDTO> toggleStatus(
            @PathVariable UUID branchId,
            @PathVariable UUID id) {
        return ResponseEntity.ok(paymentMethodService.toggleStatus(branchId, id));
    }
}
