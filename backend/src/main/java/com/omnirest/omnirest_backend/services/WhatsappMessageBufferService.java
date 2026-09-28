package com.omnirest.omnirest_backend.services;

import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.TaskScheduler;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ScheduledFuture;

@Service
@Slf4j
public class WhatsappMessageBufferService {

    private final TaskScheduler taskScheduler;
    private final N8nIntegrationService n8nIntegrationService;

    private final ConcurrentHashMap<String, StringBuilder> messageBuffers = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, ScheduledFuture<?>> scheduledTasks = new ConcurrentHashMap<>();
    private static final int WAIT_TIME_SECONDS = 4; // Ventana de inactividad

    public WhatsappMessageBufferService(TaskScheduler taskScheduler, N8nIntegrationService n8nIntegrationService) {
        this.taskScheduler = taskScheduler;
        this.n8nIntegrationService = n8nIntegrationService;
    }

    public void processIncomingMessage(String phoneNumber, String incomingText, UUID branchId) {
        if (phoneNumber == null || incomingText == null) {
            return;
        }

        // 1. Agregar el texto al buffer del número
        messageBuffers.compute(phoneNumber, (key, currentBuffer) -> {
            if (currentBuffer == null) {
                return new StringBuilder(incomingText);
            }
            return currentBuffer.append("\n").append(incomingText);
        });

        // 2. Cancelar la tarea programada anterior si existe
        ScheduledFuture<?> existingTask = scheduledTasks.get(phoneNumber);
        if (existingTask != null && !existingTask.isDone()) {
            existingTask.cancel(false);
        }

        // 3. Programar una nueva tarea para enviar el mensaje consolidado
        ScheduledFuture<?> newTask = taskScheduler.schedule(() -> {
            sendToN8n(phoneNumber, branchId);
        }, Instant.now().plusSeconds(WAIT_TIME_SECONDS));

        scheduledTasks.put(phoneNumber, newTask);
    }

    private void sendToN8n(String phoneNumber, UUID branchId) {
        try {
            StringBuilder finalMessage = messageBuffers.get(phoneNumber);
            if (finalMessage != null && finalMessage.length() > 0) {
                String consolidatedText = finalMessage.toString();
                log.info("Sending debounced consolidated message to n8n for phone {}: {}", phoneNumber, consolidatedText);
                n8nIntegrationService.sendConsolidatedMessage(phoneNumber, consolidatedText, branchId);
            }
        } catch (Exception e) {
            log.error("Error al vaciar el buffer de WhatsApp para el teléfono: {}", phoneNumber, e);
        } finally {
            messageBuffers.remove(phoneNumber);
            scheduledTasks.remove(phoneNumber);
        }
    }
}
