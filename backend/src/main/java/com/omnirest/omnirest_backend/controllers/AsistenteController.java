package com.omnirest.omnirest_backend.controllers;

import com.omnirest.omnirest_backend.security.CustomUserDetails;
import com.omnirest.omnirest_backend.services.asistente.AsistenteService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * El asistente operativo del restaurante. Quién puede usarlo y configurarlo
 * lo decide {@link AsistenteService} (dueño, gerentes y personal habilitado).
 */
@RestController
@RequestMapping("/api/v1/asistente")
@RequiredArgsConstructor
@PreAuthorize("isAuthenticated()")
public class AsistenteController {

    private final AsistenteService asistente;

    /** Si el usuario puede usarlo o configurarlo, y por qué no. */
    @GetMapping("/estado")
    public ResponseEntity<AsistenteService.Estado> estado(@AuthenticationPrincipal CustomUserDetails u) {
        return ResponseEntity.ok(asistente.estado(u));
    }

    @PostMapping("/preguntar")
    public ResponseEntity<AsistenteService.Respuesta> preguntar(@RequestBody AsistenteService.Pregunta pregunta,
                                                                @AuthenticationPrincipal CustomUserDetails u) {
        return ResponseEntity.ok(asistente.preguntar(u, pregunta));
    }

    @GetMapping("/resumenes")
    public ResponseEntity<List<AsistenteService.ResumenDTO>> resumenes(@RequestParam(required = false) UUID branchId,
                                                                       @AuthenticationPrincipal CustomUserDetails u) {
        return ResponseEntity.ok(asistente.resumenes(u, branchId));
    }

    @PostMapping("/resumenes/generar")
    public ResponseEntity<AsistenteService.ResumenDTO> generarResumen(@RequestParam(required = false) UUID branchId,
                                                                      @AuthenticationPrincipal CustomUserDetails u) {
        return ResponseEntity.ok(asistente.generarResumenAhora(u, branchId));
    }

    // ---------------------------------------------------------------- dueño

    @GetMapping("/config")
    public ResponseEntity<AsistenteService.ConfigDTO> config(@AuthenticationPrincipal CustomUserDetails u) {
        return ResponseEntity.ok(asistente.config(u));
    }

    @PutMapping("/config")
    public ResponseEntity<AsistenteService.ConfigDTO> guardar(@RequestBody AsistenteService.GuardarConfig config,
                                                              @AuthenticationPrincipal CustomUserDetails u) {
        return ResponseEntity.ok(asistente.guardar(u, config));
    }

    @PostMapping("/config/probar")
    public ResponseEntity<Map<String, String>> probar(@AuthenticationPrincipal CustomUserDetails u) {
        return ResponseEntity.ok(Map.of("respuesta", asistente.probar(u)));
    }

    @GetMapping("/personal")
    public ResponseEntity<List<AsistenteService.Persona>> personal(@AuthenticationPrincipal CustomUserDetails u) {
        return ResponseEntity.ok(asistente.personal(u));
    }

    public record Habilitar(boolean habilitado) {
    }

    @PutMapping("/personal/{userId}")
    public ResponseEntity<Void> habilitar(@PathVariable UUID userId, @RequestBody Habilitar peticion,
                                          @AuthenticationPrincipal CustomUserDetails u) {
        asistente.habilitar(u, userId, peticion.habilitado());
        return ResponseEntity.noContent().build();
    }
}
