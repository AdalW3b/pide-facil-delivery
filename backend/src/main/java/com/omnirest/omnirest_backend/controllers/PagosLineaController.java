package com.omnirest.omnirest_backend.controllers;

import com.omnirest.omnirest_backend.security.CustomUserDetails;
import com.omnirest.omnirest_backend.services.pagoslinea.PagosLineaService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/** Configuración de pagos en línea del restaurante. Solo el dueño (lo revisa el servicio). */
@RestController
@RequestMapping("/api/v1/pagos-linea")
@RequiredArgsConstructor
@PreAuthorize("isAuthenticated()")
public class PagosLineaController {

    private final PagosLineaService pagosLinea;

    public record Conectar(String origen) {
    }

    @GetMapping("/estado")
    public ResponseEntity<PagosLineaService.Estado> estado(@AuthenticationPrincipal CustomUserDetails u) {
        return ResponseEntity.ok(pagosLinea.estado(u));
    }

    /** La liga a Stripe para crear o terminar de llenar la cuenta. */
    @PostMapping("/conectar")
    public ResponseEntity<Map<String, String>> conectar(@RequestBody Conectar peticion,
                                                        @AuthenticationPrincipal CustomUserDetails u) {
        return ResponseEntity.ok(Map.of("url", pagosLinea.conectar(u, peticion.origen())));
    }

    @PostMapping("/sincronizar")
    public ResponseEntity<PagosLineaService.Estado> sincronizar(@AuthenticationPrincipal CustomUserDetails u) {
        return ResponseEntity.ok(pagosLinea.sincronizar(u));
    }

    @PutMapping("/ajustes")
    public ResponseEntity<PagosLineaService.Estado> ajustes(@RequestBody PagosLineaService.Ajustes ajustes,
                                                            @AuthenticationPrincipal CustomUserDetails u) {
        return ResponseEntity.ok(pagosLinea.ajustes(u, ajustes));
    }

    @PostMapping("/desconectar")
    public ResponseEntity<PagosLineaService.Estado> desconectar(@AuthenticationPrincipal CustomUserDetails u) {
        return ResponseEntity.ok(pagosLinea.desconectar(u));
    }

    @GetMapping("/bitacora")
    public ResponseEntity<List<PagosLineaService.Movimiento>> bitacora(@AuthenticationPrincipal CustomUserDetails u) {
        return ResponseEntity.ok(pagosLinea.bitacora(u));
    }
}
