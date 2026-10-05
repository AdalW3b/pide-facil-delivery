package com.omnirest.omnirest_backend.controllers;

import com.omnirest.omnirest_backend.security.CustomUserDetails;
import com.omnirest.omnirest_backend.services.AvisosSistemaService;
import com.omnirest.omnirest_backend.services.SoporteService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.UUID;

/**
 * Lo del dueño frente a la plataforma: el código con que autoriza cambios de
 * soporte, la bitácora de lo que hizo soporte y los avisos de la campana.
 */
@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
@PreAuthorize("hasAuthority('SUPER_ADMIN')")
public class SoporteDuenoController {

    private final SoporteService soporteService;
    private final AvisosSistemaService avisosService;

    /** Un código de 6 cifras, válido 15 minutos, para dictárselo a soporte. */
    @PostMapping("/soporte/codigos")
    public ResponseEntity<SoporteService.CodigoGenerado> generarCodigo(@AuthenticationPrincipal CustomUserDetails dueno) {
        return ResponseEntity.ok(soporteService.generarCodigo(dueno));
    }

    /** Cuándo entró soporte, por qué y qué cambió. */
    @GetMapping("/soporte/bitacora")
    public ResponseEntity<List<SoporteService.Bitacora>> bitacora(@AuthenticationPrincipal CustomUserDetails dueno) {
        return ResponseEntity.ok(soporteService.bitacora(restaurante(dueno)));
    }

    @GetMapping("/avisos")
    public ResponseEntity<AvisosSistemaService.Bandeja> avisos(@AuthenticationPrincipal CustomUserDetails dueno) {
        return ResponseEntity.ok(avisosService.bandeja(restaurante(dueno)));
    }

    @PatchMapping("/avisos/leidos")
    public ResponseEntity<Void> marcarLeidos(@AuthenticationPrincipal CustomUserDetails dueno) {
        avisosService.marcarLeidos(restaurante(dueno));
        return ResponseEntity.noContent().build();
    }

    private static UUID restaurante(CustomUserDetails dueno) {
        if (dueno == null || dueno.restaurantId() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Tu usuario no tiene restaurante.");
        }
        return dueno.restaurantId();
    }
}
