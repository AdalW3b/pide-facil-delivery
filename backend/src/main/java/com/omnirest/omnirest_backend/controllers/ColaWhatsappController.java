package com.omnirest.omnirest_backend.controllers;

import com.omnirest.omnirest_backend.services.ColaWhatsapp;
import com.omnirest.omnirest_backend.services.SecurityValidationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

/**
 * Si los avisos de WhatsApp de la sucursal estan saliendo. El panel lo
 * consulta para decirlo en pantalla: antes, cuando WhatsApp se desconectaba,
 * los mensajes se perdian sin que nadie en el restaurante se enterara.
 */
@RestController
@RequiredArgsConstructor
public class ColaWhatsappController {

    private final ColaWhatsapp colaWhatsapp;
    private final SecurityValidationService securityValidationService;

    @GetMapping("/api/v1/branches/{branchId}/whatsapp/salud")
    public ResponseEntity<ColaWhatsapp.Salud> salud(@PathVariable UUID branchId) {
        securityValidationService.validateUserAccessToBranch(branchId);
        return ResponseEntity.ok(colaWhatsapp.salud(branchId));
    }
}
