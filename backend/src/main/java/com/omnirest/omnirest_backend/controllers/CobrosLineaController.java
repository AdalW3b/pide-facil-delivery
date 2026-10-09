package com.omnirest.omnirest_backend.controllers;

import com.omnirest.omnirest_backend.security.CustomUserDetails;
import com.omnirest.omnirest_backend.services.pagoslinea.TransaccionesLineaService;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/** Cobros con tarjeta del menu en linea: lista, detalle y devoluciones. Los permisos los revisa el servicio. */
@RestController
@RequestMapping("/api/v1/pagos-linea")
@RequiredArgsConstructor
@PreAuthorize("isAuthenticated()")
public class CobrosLineaController {

    private final TransaccionesLineaService transacciones;

    public record ReembolsoPedido(String motivo) {
    }

    @GetMapping("/transacciones")
    public ResponseEntity<List<TransaccionesLineaService.Fila>> listar(
            @RequestParam(required = false) UUID branchId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate desde,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate hasta,
            @RequestParam(defaultValue = "false") boolean todos,
            @AuthenticationPrincipal CustomUserDetails u) {
        return ResponseEntity.ok(transacciones.listar(u, branchId, desde, hasta, todos));
    }

    @GetMapping("/transacciones/{id}")
    public ResponseEntity<TransaccionesLineaService.Detalle> detalle(@PathVariable UUID id,
                                                                     @AuthenticationPrincipal CustomUserDetails u) {
        return ResponseEntity.ok(transacciones.detalle(u, id));
    }

    @PostMapping("/transacciones/{id}/reembolsos")
    public ResponseEntity<TransaccionesLineaService.Detalle> reembolsar(
            @PathVariable UUID id, @RequestBody TransaccionesLineaService.PedirReembolso peticion,
            @AuthenticationPrincipal CustomUserDetails u) {
        return ResponseEntity.ok(transacciones.reembolsar(u, id, peticion));
    }

    /** Al cancelar un pedido pagado con tarjeta, devolver todo. */
    @PostMapping("/pedidos/{orderId}/reembolso")
    public ResponseEntity<TransaccionesLineaService.Detalle> reembolsarPedido(
            @PathVariable UUID orderId, @RequestBody(required = false) ReembolsoPedido peticion,
            @AuthenticationPrincipal CustomUserDetails u) {
        return ResponseEntity.ok(transacciones.reembolsarPedido(u, orderId, peticion != null ? peticion.motivo() : null));
    }
}
