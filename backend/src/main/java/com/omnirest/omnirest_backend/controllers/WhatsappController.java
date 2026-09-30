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
import java.util.Optional;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/branches/{branchId}/whatsapp")
@RequiredArgsConstructor
public class WhatsappController {

    private final SecurityValidationService securityValidationService;
    private final BranchRepository branchRepository;
    private final WhatsappIntegrationService whatsappIntegrationService;
    private final com.omnirest.omnirest_backend.services.NumerosDeSucursal numerosDeSucursal;

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

        // Solo se manda un webhook si la sucursal tiene uno propio a proposito.
        // Si no, el servicio de WhatsApp elige el del bot de restaurantes
        // (OMNIREST_WEBHOOK_URL). Antes se mandaba N8N_WEBHOOK_URL de este
        // backend, que apuntaba a un webhook de prueba de otro flujo: el
        // servicio lo guardaba para siempre y el bot de esa sucursal no respondia.
        Branch branch = branchRepository.findById(branchId).orElse(null);
        String webhookUrl = (branch != null && branch.getN8nWebhookUrl() != null && !branch.getN8nWebhookUrl().isBlank())
                ? branch.getN8nWebhookUrl()
                : null;

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

            return ResponseEntity.ok(revisarNumero(branchId, response));
        } catch (Exception e) {
            return ResponseEntity.ok(Map.of(
                    "status", "disconnected",
                    "connected", false,
                    "message", "Servicio de WhatsApp no disponible"
            ));
        }
    }

    /**
     * Un numero, una sucursal. El servicio de WhatsApp ya rechaza un telefono
     * que esta conectado en otra sesion ("error_duplicate_number"); aqui se le
     * explica al usuario cual sucursal lo tiene. Y cuando la sucursal conecta
     * bien, se guarda su numero real: es el que usa el QR de las mesas.
     */
    private Map<String, Object> revisarNumero(UUID branchId, Map<String, Object> respuesta) {
        if (respuesta == null) return null;
        Map<String, Object> r = new HashMap<>(respuesta);
        Object estado = r.get("status");
        String numero = r.get("number") != null ? r.get("number").toString() : null;

        if ("error_duplicate_number".equals(estado)) {
            String otra = "otra sucursal";
            Object idOtra = r.get("duplicateConflictId");
            if (idOtra != null) {
                try {
                    otra = branchRepository.findById(UUID.fromString(idOtra.toString()))
                            .map(com.omnirest.omnirest_backend.services.NumerosDeSucursal::descripcion)
                            .map(n -> "la sucursal " + n)
                            .orElse(otra);
                } catch (IllegalArgumentException ignorado) {
                    // La otra sesion no es una sucursal (otro sistema conectado al mismo servicio).
                }
            }
            r.put("connected", false);
            r.put("message", "Ese WhatsApp ya está conectado en " + otra
                    + ". Cada sucursal necesita su propio número: escanea el código con otro teléfono.");
            return r;
        }

        if ("open".equals(estado) && numero != null && !numero.isBlank()) {
            Optional<Branch> otra = numerosDeSucursal.duenoDe(numero, branchId);
            if (otra.isPresent()) {
                // Conectado, pero ese numero esta registrado en otra sucursal: se avisa y no se sobrescribe.
                r.put("warning", "Este número también está registrado en la sucursal "
                        + com.omnirest.omnirest_backend.services.NumerosDeSucursal.descripcion(otra.get())
                        + ". Revisa el número de esa sucursal en Ajustes → Sucursales.");
            } else {
                branchRepository.findById(branchId).ifPresent(b -> {
                    String real = com.omnirest.omnirest_backend.services.NumerosDeSucursal.paraGuardar(numero);
                    if (real != null && !real.equals(b.getWhatsappNumber())) {
                        b.setWhatsappNumber(real);
                        branchRepository.save(b);
                    }
                });
            }
        }
        return r;
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
