package com.omnirest.omnirest_backend.services;

import com.omnirest.omnirest_backend.dtos.WhatsappQrResponseDTO;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import java.util.Map;

@Slf4j
@Service
public class WhatsappIntegrationService {

    private final RestClient restClient;
    private final String brandOrigin;

    public WhatsappIntegrationService(
            @Value("${whatsapp.service-url}") String serviceUrl,
            @Value("${app.brand-origin:omnirest}") String brandOrigin) {
        this.restClient = RestClient.builder()
            .baseUrl(serviceUrl)
            .build();
        this.brandOrigin = brandOrigin;
    }

    public WhatsappQrResponseDTO getQrCode(String whatsappNumber) {
        try {
            restClient.post()
                .uri("/connect")
                .contentType(MediaType.APPLICATION_JSON)
                .body(Map.of(
                    "accountId", whatsappNumber,
                    "phoneNumber", whatsappNumber,
                    "origin", brandOrigin
                ))
                .retrieve()
                .toBodilessEntity();
        } catch (Exception e) {
            log.warn("Error initiating WhatsApp session for account {}: {}", whatsappNumber, e.getMessage(), e);
        }

        Map<?, ?> response = restClient.get()
            .uri(uriBuilder -> uriBuilder.path("/status")
                .queryParam("accountId", whatsappNumber)
                .build())
            .retrieve()
            .body(Map.class);

        if (response == null) {
            throw new IllegalStateException("Failed to retrieve status from WhatsApp integration service");
        }

        String status = (String) response.get("status");
        String qr = (String) response.get("qr");
        String pairingCode = (String) response.get("pairingCode");

        return new WhatsappQrResponseDTO(status, qr, pairingCode);
    }

    public String getActiveWhatsappNumber(String branchId) {
        try {
            Map<?, ?> response = restClient.get()
                .uri(uriBuilder -> uriBuilder.path("/status")
                    .queryParam("accountId", branchId)
                    .build())
                .retrieve()
                .body(Map.class);

            if (response != null) {
                return (String) response.get("number");
            }
        } catch (Exception e) {
            log.error("Error retrieving active WhatsApp number for branch {}: {}", branchId, e.getMessage(), e);
        }
        return null;
    }

    /**
     * Los grupos de WhatsApp de la sucursal, para poder elegir el de
     * repartidores de una lista en vez de pegar su identificador a mano.
     * Devuelve vacio si la sucursal no tiene WhatsApp conectado.
     */
    @SuppressWarnings("unchecked")
    public java.util.List<java.util.Map<String, Object>> listGroups(String branchId) {
        try {
            java.util.List<?> response = restClient.get()
                .uri(uriBuilder -> uriBuilder.path("/groups")
                    .queryParam("accountId", branchId)
                    .build())
                .retrieve()
                .body(java.util.List.class);

            return response == null
                ? java.util.List.of()
                : (java.util.List<java.util.Map<String, Object>>) response;
        } catch (Exception e) {
            log.warn("No se pudieron listar los grupos de WhatsApp de la sucursal {}: {}", branchId, e.getMessage());
            return java.util.List.of();
        }
    }

    public void sendMessage(String senderNumber, String recipientNumber, String message) {
        restClient.post()
            .uri("/send-message")
            .contentType(MediaType.APPLICATION_JSON)
            .body(Map.of(
                "accountId", senderNumber,
                "number", recipientNumber,
                "message", message
            ))
            .retrieve()
            .toBodilessEntity();
    }
}
