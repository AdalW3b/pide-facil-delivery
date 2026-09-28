package com.omnirest.omnirest_backend.controllers;

import com.omnirest.omnirest_backend.domain.entities.Branch;
import com.omnirest.omnirest_backend.dtos.SendWhatsappRequestDTO;
import com.omnirest.omnirest_backend.repositories.BranchRepository;
import com.omnirest.omnirest_backend.services.SecurityValidationService;
import com.omnirest.omnirest_backend.services.WhatsappIntegrationService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestClient;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/branches/{branchId}/whatsapp")
@RequiredArgsConstructor
public class WhatsappController {

    private final SecurityValidationService securityValidationService;
    private final BranchRepository branchRepository;
    private final WhatsappIntegrationService whatsappIntegrationService;

    @Value("${whatsapp.service-url:http://localhost:4000}")
    private String whatsappServiceUrl;

    @Value("${n8n.webhook-url:}")
    private String n8nWebhookUrl;

    @Value("${app.brand-name:OmniRest}")
    private String brandName;

    @Value("${app.brand-origin:omnirest}")
    private String brandOrigin;

    private RestClient getRestClient() {
        return RestClient.builder().baseUrl(whatsappServiceUrl).build();
    }

    @PostMapping("/qr")
    @PreAuthorize("hasAuthority('WHATSAPP_UPDATE')")
    public ResponseEntity<Map<String, Object>> connectWhatsapp(
            @PathVariable UUID branchId) {
        
        securityValidationService.validateUserAccessToBranch(branchId);

        Branch branch = branchRepository.findById(branchId).orElse(null);
        String webhookUrl = (branch != null && branch.getN8nWebhookUrl() != null && !branch.getN8nWebhookUrl().isBlank())
                ? branch.getN8nWebhookUrl()
                : n8nWebhookUrl;

        Map<String, Object> body = new HashMap<>();
        body.put("accountId", branchId.toString());
        body.put("browserName", brandName + " Dashboard");
        body.put("companyId", branchId.toString());
        body.put("origin", brandOrigin);
        if (webhookUrl != null && !webhookUrl.isBlank()) {
            body.put("webhookUrl", webhookUrl);
        }

        try {
            Map<String, Object> response = getRestClient().post()
                    .uri("/connect")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(body)
                    .retrieve()
                    .body(Map.class);

            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.ok(Map.of(
                    "status", "error",
                    "connected", false,
                    "message", "No se pudo conectar con el servicio de WhatsApp"
            ));
        }
    }

    @GetMapping("/status")
    @PreAuthorize("hasAnyAuthority('WHATSAPP_READ', 'WHATSAPP_UPDATE', 'TABLES_READ', 'SUPER_ADMIN', 'SYSTEM_ADMIN', 'BRANCH_MANAGER')")
    public ResponseEntity<Map<String, Object>> getStatus(
            @PathVariable UUID branchId) {

        securityValidationService.validateUserAccessToBranch(branchId);

        try {
            Map<String, Object> response = getRestClient().get()
                    .uri(uriBuilder -> uriBuilder.path("/status")
                            .queryParam("accountId", branchId.toString())
                            .build())
                    .retrieve()
                    .body(Map.class);

            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.ok(Map.of(
                    "status", "disconnected",
                    "connected", false,
                    "message", "Servicio de WhatsApp no disponible"
            ));
        }
    }

    @PostMapping("/logout")
    @PreAuthorize("hasAuthority('WHATSAPP_UPDATE')")
    public ResponseEntity<Map<String, Object>> logout(
            @PathVariable UUID branchId) {

        securityValidationService.validateUserAccessToBranch(branchId);

        Map<String, Object> body = Map.of(
                "accountId", branchId.toString()
        );

        try {
            Map<String, Object> response = getRestClient().post()
                    .uri("/logout")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(body)
                    .retrieve()
                    .body(Map.class);

            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.ok(Map.of(
                    "status", "disconnected",
                    "connected", false,
                    "message", "Sesión de WhatsApp cerrada o servicio no disponible"
            ));
        }
    }

    @PostMapping("/send")
    @PreAuthorize("hasAuthority('WHATSAPP_UPDATE')")
    public ResponseEntity<Void> sendMessage(
            @PathVariable UUID branchId,
            @Valid @RequestBody SendWhatsappRequestDTO request) {
        
        securityValidationService.validateUserAccessToBranch(branchId);

        Branch branch = branchRepository.findById(branchId)
                .orElseThrow(() -> new IllegalArgumentException("Branch not found"));

        String senderNumber = branch.getWhatsappNumber();
        if (senderNumber == null || senderNumber.isBlank()) {
            throw new IllegalArgumentException("No WhatsApp number configured for this branch");
        }

        whatsappIntegrationService.sendMessage(senderNumber, request.recipientNumber(), request.message());
        return ResponseEntity.ok().build();
    }
}
