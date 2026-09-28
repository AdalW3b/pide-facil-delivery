package com.omnirest.omnirest_backend.services;

import com.omnirest.omnirest_backend.domain.entities.Branch;
import com.omnirest.omnirest_backend.repositories.BranchRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class N8nIntegrationService {

    private final BranchRepository branchRepository;
    private final RestClient.Builder restClientBuilder = RestClient.builder();

    public void sendConsolidatedMessage(String phoneNumber, String message, UUID branchId) {
        if (branchId == null) {
            log.warn("Cannot send message to n8n: branchId is null for phone {}", phoneNumber);
            return;
        }

        Branch branch = branchRepository.findById(branchId).orElse(null);
        if (branch == null || branch.getN8nWebhookUrl() == null || branch.getN8nWebhookUrl().isBlank()) {
            log.warn("No n8n webhook URL configured for branch {}", branchId);
            return;
        }

        String webhookUrl = branch.getN8nWebhookUrl();

        Map<String, Object> payload = Map.of(
                "phoneNumber", phoneNumber,
                "message", message,
                "branchId", branchId.toString()
        );

        try {
            restClientBuilder.build().post()
                    .uri(webhookUrl)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(payload)
                    .retrieve()
                    .toBodilessEntity();
            log.info("Successfully sent consolidated WhatsApp message to n8n for phone {} at branch {}", phoneNumber, branchId);
        } catch (Exception e) {
            log.error("Failed to send consolidated message to n8n webhook URL {}: {}", webhookUrl, e.getMessage(), e);
        }
    }
}
