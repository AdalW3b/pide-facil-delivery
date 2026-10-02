package com.omnirest.omnirest_backend.controllers;

import com.omnirest.omnirest_backend.domain.entities.RappiTienda;
import com.omnirest.omnirest_backend.services.RappiService;
import com.omnirest.omnirest_backend.services.SecurityValidationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.UUID;

/**
 * Rappi: los avisos que manda por webhook y la liga de cada sucursal con su
 * tienda.
 *
 * Cada evento tiene su propia URL ({@code /api/v1/webhooks/rappi/new-order},
 * {@code .../cancel}, etc.), que es la que se registra en Rappi. Todas exigen
 * la firma {@code Rappi-Signature}: son publicas, pero sin el secreto no
 * entra nada.
 */
@Slf4j
@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
public class RappiController {

    private final RappiService rappiService;
    private final SecurityValidationService securityValidationService;

    // ------------------------------------------------------------------
    // Webhooks (publicos, firmados)
    // ------------------------------------------------------------------

    @PostMapping("/webhooks/rappi/{evento}")
    public ResponseEntity<Map<String, Object>> webhook(
            @PathVariable String evento,
            @RequestBody String cuerpo,
            @RequestHeader(value = "Rappi-Signature", required = false) String firma) {
        if (!rappiService.activa()) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(Map.of("error", "La integración con Rappi no está configurada."));
        }
        // Firma mala: distinto de 2xx y sin procesar, como pide Rappi.
        if (!rappiService.firmaValida(firma, cuerpo)) {
            log.warn("Rappi: webhook {} con firma invalida", evento);
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Firma inválida."));
        }

        try {
            return switch (evento) {
                case "new-order" -> ResponseEntity.ok(Map.of("pedidos", rappiService.recibirPedidos(cuerpo)));
                case "cancel" -> {
                    rappiService.cancelar(cuerpo);
                    yield ResponseEntity.ok(Map.of("status", "OK"));
                }
                case "other-event" -> {
                    rappiService.otroEvento(cuerpo);
                    yield ResponseEntity.ok(Map.of("status", "OK"));
                }
                case "ping" -> ResponseEntity.ok(Map.of("status", "OK", "description", rappiService.ping(cuerpo)));
                case "store-connectivity" -> {
                    rappiService.conectividad(cuerpo);
                    yield ResponseEntity.ok(Map.of("status", "OK"));
                }
                default -> ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(Map.of("error", "Evento de Rappi desconocido: " + evento));
            };
        } catch (IllegalArgumentException | tools.jackson.core.JacksonException e) {
            // Un pedido que no se puede ubicar (tienda sin ligar, JSON roto) no
            // va a mejorar con reintentos.
            log.error("Rappi: webhook {} rechazado: {}", evento, e.getMessage());
            return ResponseEntity.status(HttpStatus.UNPROCESSABLE_CONTENT)
                    .body(Map.of("error", e.getMessage() != null ? e.getMessage() : "Aviso de Rappi ilegible."));
        }
    }

    // ------------------------------------------------------------------
    // Liga de la sucursal (panel)
    // ------------------------------------------------------------------

    public record TiendaRappiDTO(String storeId, Boolean habilitada, String mensaje,
                                 LocalDateTime ligadaEn, LocalDateTime actualizadaEn) {
        static TiendaRappiDTO de(RappiTienda t) {
            return new TiendaRappiDTO(t.getStoreId(), t.getHabilitada(), t.getMensaje(),
                    t.getLigadaEn(), t.getActualizadaEn());
        }
    }

    public record LigarTiendaRappiDTO(String storeId) {
    }

    /** La tienda de Rappi de la sucursal; 204 si no tiene. */
    @GetMapping("/branches/{branchId}/rappi")
    @PreAuthorize("hasAnyAuthority('SUPER_ADMIN', 'SYSTEM_ADMIN', 'BRANCH_UPDATE')")
    public ResponseEntity<TiendaRappiDTO> tienda(@PathVariable UUID branchId) {
        securityValidationService.validateUserAccessToBranch(branchId);
        return rappiService.tienda(branchId)
                .map(t -> ResponseEntity.ok(TiendaRappiDTO.de(t)))
                .orElse(ResponseEntity.noContent().build());
    }

    @PutMapping("/branches/{branchId}/rappi")
    @PreAuthorize("hasAnyAuthority('SUPER_ADMIN', 'SYSTEM_ADMIN', 'BRANCH_UPDATE')")
    public ResponseEntity<TiendaRappiDTO> ligar(@PathVariable UUID branchId, @RequestBody LigarTiendaRappiDTO peticion) {
        securityValidationService.validateUserAccessToBranch(branchId);
        return ResponseEntity.ok(TiendaRappiDTO.de(rappiService.ligar(branchId, peticion.storeId())));
    }

    @DeleteMapping("/branches/{branchId}/rappi")
    @PreAuthorize("hasAnyAuthority('SUPER_ADMIN', 'SYSTEM_ADMIN', 'BRANCH_UPDATE')")
    public ResponseEntity<Void> desligar(@PathVariable UUID branchId) {
        securityValidationService.validateUserAccessToBranch(branchId);
        rappiService.desligar(branchId);
        return ResponseEntity.noContent().build();
    }
}
