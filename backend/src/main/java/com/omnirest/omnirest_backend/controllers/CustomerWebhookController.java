package com.omnirest.omnirest_backend.controllers;

import com.omnirest.omnirest_backend.domain.entities.Branch;
import com.omnirest.omnirest_backend.dtos.BillSummaryDTO;
import com.omnirest.omnirest_backend.dtos.CustomerIdentifyRequestDTO;
import com.omnirest.omnirest_backend.dtos.CustomerResponseDTO;
import com.omnirest.omnirest_backend.dtos.MenuCategoryDTO;
import com.omnirest.omnirest_backend.dtos.UpdateCustomerNameDTO;
import com.omnirest.omnirest_backend.dtos.WebhookOrderRequestDTO;
import com.omnirest.omnirest_backend.repositories.BranchRepository;
import com.omnirest.omnirest_backend.services.CustomerService;
import com.omnirest.omnirest_backend.services.OrderService;
import com.omnirest.omnirest_backend.services.WhatsappMessageBufferService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.annotation.*;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/webhooks")
@RequiredArgsConstructor
public class CustomerWebhookController {

    @Value("${bot.secret}")
    private String botTokenSecret;

    private final CustomerService customerService;
    private final OrderService orderService;
    private final WhatsappMessageBufferService whatsappMessageBufferService;
    private final BranchRepository branchRepository;

    @PostMapping("/branches/{branchId}/customers/identify")
    public ResponseEntity<CustomerResponseDTO> identifyCustomer(
            @RequestHeader(value = "X-Bot-Token", required = false) String botToken,
            @PathVariable UUID branchId,
            @Valid @RequestBody CustomerIdentifyRequestDTO request) {
        validateBot(botToken, branchId);
        return ResponseEntity.ok(customerService.identifyCustomer(branchId, request));
    }

    @PostMapping("/branches/{branchId}/whatsapp/incoming")
    public ResponseEntity<Void> handleIncomingWhatsappMessage(
            @RequestHeader(value = "X-Bot-Token", required = false) String botToken,
            @PathVariable UUID branchId,
            @RequestBody Map<String, Object> payload) {
        validateBot(botToken, branchId);

        String phoneNumber = null;
        if (payload.get("phoneNumber") != null) {
            phoneNumber = payload.get("phoneNumber").toString();
        } else if (payload.get("from") != null) {
            phoneNumber = payload.get("from").toString();
        } else if (payload.get("phone") != null) {
            phoneNumber = payload.get("phone").toString();
        }

        String text = null;
        if (payload.get("text") != null) {
            text = payload.get("text").toString();
        } else if (payload.get("message") != null) {
            text = payload.get("message").toString();
        } else if (payload.get("body") != null) {
            text = payload.get("body").toString();
        }

        if (phoneNumber != null && text != null) {
            whatsappMessageBufferService.processIncomingMessage(phoneNumber, text, branchId);
        }

        return ResponseEntity.ok().build();
    }

    @GetMapping("/branches/{branchId}/menu")
    public ResponseEntity<List<MenuCategoryDTO>> getMenu(
            @RequestHeader(value = "X-Bot-Token", required = false) String botToken,
            @PathVariable UUID branchId) {
        validateBot(botToken, branchId);
        return ResponseEntity.ok(customerService.getMenuForBranch(branchId));
    }

    @PostMapping("/orders/items")
    public ResponseEntity<Void> createOrderItems(
            @RequestHeader(value = "X-Bot-Token", required = false) String botToken,
            @Valid @RequestBody WebhookOrderRequestDTO request) {
        validateBot(botToken, request != null ? request.branchId() : null);
        orderService.addWebhookItems(request);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/branches/{branchId}/tables/{tableNumber}/open")
    public ResponseEntity<com.omnirest.omnirest_backend.dtos.OrderResponseDTO> openTableWebhook(
            @RequestHeader(value = "X-Bot-Token", required = false) String botToken,
            @PathVariable java.util.UUID branchId,
            @PathVariable Integer tableNumber,
            @RequestBody(required = false) java.util.Map<String, String> payload) {

        validateBot(botToken, branchId);
        String phoneNumber = payload != null ? payload.get("phoneNumber") : null;

        return ResponseEntity.ok(orderService.openOrder(branchId, tableNumber, phoneNumber));
    }

    @PostMapping("/branches/{branchId}/tables/{tableNumber}/close")
    public ResponseEntity<Map<String, Object>> closeTable(
            @RequestHeader(value = "X-Bot-Token", required = false) String botToken,
            @PathVariable UUID branchId,
            @PathVariable Integer tableNumber) {
        validateBot(botToken, branchId);
        orderService.closeTable(branchId, tableNumber);
        return ResponseEntity.ok(Map.of("message", "Mesa cerrada con éxito"));
    }

    @GetMapping("/branches/{branchId}/tables/{tableNumber}/bill")
    public ResponseEntity<BillSummaryDTO> getTableBill(
            @RequestHeader(value = "X-Bot-Token", required = false) String botToken,
            @PathVariable UUID branchId,
            @PathVariable Integer tableNumber) {
        validateBot(botToken, branchId);
        return ResponseEntity.ok(orderService.getBillForTable(branchId, tableNumber));
    }

    @PostMapping("/branches/{branchId}/tables/{tableNumber}/help")
    public ResponseEntity<Void> requestHelp(
            @RequestHeader(value = "X-Bot-Token", required = false) String botToken,
            @PathVariable UUID branchId,
            @PathVariable Integer tableNumber) {
        validateBot(botToken, branchId);
        orderService.notifyWaiters(branchId, tableNumber, "HELP",
                "La Mesa " + tableNumber + " solicita asistencia humana.");
        return ResponseEntity.ok().build();
    }

    @PostMapping("/branches/{branchId}/tables/{tableNumber}/payment-intent")
    public ResponseEntity<Void> notifyPaymentIntent(
            @RequestHeader(value = "X-Bot-Token", required = false) String botToken,
            @PathVariable UUID branchId,
            @PathVariable Integer tableNumber,
            @RequestBody Map<String, String> payload) {
        validateBot(botToken, branchId);
        String paymentMethod = payload != null ? payload.get("paymentMethod") : null;
        if (paymentMethod == null && payload != null) {
            paymentMethod = payload.get("method");
        }
        orderService.notifyPaymentIntent(branchId, tableNumber, paymentMethod);
        return ResponseEntity.ok().build();
    }

    @PatchMapping("/{phoneNumber}/name")
    public ResponseEntity<Void> updateCustomerName(
            @RequestHeader(value = "X-Bot-Token", required = false) String botToken,
            @PathVariable String phoneNumber,
            @Valid @RequestBody UpdateCustomerNameDTO request) {
        validateBot(botToken, null);
        customerService.updateCustomerName(phoneNumber, request);
        return ResponseEntity.ok().build();
    }

    @PatchMapping("/branches/{branchId}/customers/{phoneNumber}/name")
    public ResponseEntity<Map<String, String>> updateCustomerName(
            @RequestHeader(value = "X-Bot-Token", required = false) String botToken,
            @PathVariable UUID branchId,
            @PathVariable String phoneNumber,
            @RequestBody Map<String, String> payload) { // <-- Cambiamos String por Map para recibir el JSON
                                                        // correctamente

        // 1. Validamos que el webhook sea legítimo
        validateBot(botToken, branchId);

        // 2. Extraemos el nombre del JSON que envía n8n
        String cleanName = payload.get("name");
        if (cleanName != null) {
            cleanName = cleanName.trim();
        }

        if (cleanName == null || cleanName.isBlank()) {
            return ResponseEntity.ok(Map.of("message", "Sin nombre que guardar"));
        }

        // 3. Se guarda solo en el cliente de ESTE restaurante. El mismo telefono
        // puede ser cliente de otros y no hay que tocarlos.
        customerService.updateCustomerName(branchId, phoneNumber, cleanName);

        return ResponseEntity.ok(Map.of("message", "Nombre actualizado a: " + cleanName));
    }

    private void validateBot(String token, UUID branchId) {
        if (token == null) {
            throw new AccessDeniedException("Acceso denegado: Token de bot inválido o ausente");
        }

        String expectedSecret = null;
        if (branchId != null) {
            expectedSecret = branchRepository.findById(branchId)
                    .map(Branch::getWebhookSecret)
                    .filter(secret -> secret != null && !secret.isBlank())
                    .orElse(null);
        }

        if (expectedSecret == null) {
            expectedSecret = botTokenSecret;
        }

        if (expectedSecret == null || !MessageDigest.isEqual(
                token.getBytes(StandardCharsets.UTF_8),
                expectedSecret.getBytes(StandardCharsets.UTF_8))) {
            throw new AccessDeniedException("Acceso denegado: Token de bot inválido o ausente");
        }
    }

    @GetMapping("/branches/{branchId}/bot-config")
    public ResponseEntity<Map<String, Object>> getBotConfigForWebhook(
            @RequestHeader(value = "X-Bot-Token", required = false) String botToken,
            @PathVariable UUID branchId) {

        validateBot(botToken, branchId);

        Branch branch = branchRepository.findById(branchId)
                .orElseThrow(() -> new IllegalArgumentException("Sucursal no encontrada"));

        return ResponseEntity.ok(Map.of(
                "botName", branch.getBotName() != null ? branch.getBotName() : "OmniBot",
                "botTone", branch.getBotTone() != null ? branch.getBotTone() : "Amable, servicial y conciso",
                "restaurantId", branch.getRestaurant().getId()));
    }
}
