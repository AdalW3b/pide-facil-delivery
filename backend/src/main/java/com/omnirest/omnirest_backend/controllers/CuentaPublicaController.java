package com.omnirest.omnirest_backend.controllers;

import com.omnirest.omnirest_backend.dtos.CuentaResponseDTO;
import com.omnirest.omnirest_backend.dtos.IniciarSesionCuentaDTO;
import com.omnirest.omnirest_backend.dtos.RegistrarCuentaDTO;
import com.omnirest.omnirest_backend.dtos.SolicitarCodigoDTO;
import com.omnirest.omnirest_backend.security.CuentaPublicaPrincipal;
import com.omnirest.omnirest_backend.services.CuentaPublicaService;
import com.omnirest.omnirest_backend.services.HistorialCuentaService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Cuentas de clientes y repartidores.
 *
 * Todo cuelga de una sucursal porque la cuenta es de un restaurante, igual que
 * la ficha: el mismo telefono puede ser cliente de varios negocios sin que eso
 * los mezcle.
 */
@RestController
@RequestMapping("/api/v1/public/branches/{branchId}/cuenta")
@RequiredArgsConstructor
public class CuentaPublicaController {

    private final CuentaPublicaService cuentaService;
    private final HistorialCuentaService historialService;

    /** Manda por WhatsApp el codigo para comprobar que el numero es suyo. */
    @PostMapping("/codigo")
    public ResponseEntity<Map<String, String>> solicitarCodigo(
            @PathVariable UUID branchId,
            @Valid @RequestBody SolicitarCodigoDTO request) {
        cuentaService.solicitarCodigo(branchId, request.tipo(), request.phoneNumber());
        // Siempre la misma respuesta: confirmar si el numero existe le diria a
        // un extrano quien es cliente del negocio.
        return ResponseEntity.ok(Map.of(
                "message", "Si el número es válido, te llegará un código por WhatsApp."));
    }

    @PostMapping("/registro")
    public ResponseEntity<CuentaResponseDTO> registrar(
            @PathVariable UUID branchId,
            @Valid @RequestBody RegistrarCuentaDTO request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(cuentaService.registrar(branchId, request));
    }

    @PostMapping("/login")
    public ResponseEntity<CuentaResponseDTO> iniciarSesion(
            @PathVariable UUID branchId,
            @Valid @RequestBody IniciarSesionCuentaDTO request,
            HttpServletRequest http) {
        return ResponseEntity.ok(cuentaService.iniciarSesion(branchId, request, http.getRemoteAddr()));
    }

    /** Para quien olvido su contrasena: pide codigo otra vez. */
    @PostMapping("/contrasena")
    public ResponseEntity<Map<String, String>> restablecer(
            @PathVariable UUID branchId,
            @Valid @RequestBody RegistrarCuentaDTO request) {
        cuentaService.restablecerContrasena(branchId, request);
        return ResponseEntity.ok(Map.of("message", "Tu contraseña quedó actualizada."));
    }

    // ------------------------------------------------------------------
    // Lo suyo
    // ------------------------------------------------------------------

    /** Los pedidos del cliente que tiene la sesion abierta. */
    @GetMapping("/pedidos")
    @PreAuthorize("hasAuthority('CUENTA_CLIENTE')")
    public ResponseEntity<List<?>> misPedidos(
            @PathVariable UUID branchId,
            @AuthenticationPrincipal CuentaPublicaPrincipal cuenta) {
        return ResponseEntity.ok(historialService.pedidosDelCliente(cuenta));
    }

    /** Las direcciones guardadas del cliente, para pedir sin volver a marcar el pin. */
    @GetMapping("/direcciones")
    @PreAuthorize("hasAuthority('CUENTA_CLIENTE')")
    public ResponseEntity<List<?>> misDirecciones(
            @PathVariable UUID branchId,
            @AuthenticationPrincipal CuentaPublicaPrincipal cuenta) {
        return ResponseEntity.ok(historialService.direccionesDelCliente(branchId, cuenta));
    }

    @DeleteMapping("/direcciones/{direccionId}")
    @PreAuthorize("hasAuthority('CUENTA_CLIENTE')")
    public ResponseEntity<Void> borrarDireccion(
            @PathVariable UUID branchId,
            @PathVariable UUID direccionId,
            @AuthenticationPrincipal CuentaPublicaPrincipal cuenta) {
        historialService.borrarDireccion(cuenta, direccionId);
        return ResponseEntity.noContent().build();
    }

    /** Las entregas del repartidor que tiene la sesion abierta. */
    @GetMapping("/entregas")
    @PreAuthorize("hasAuthority('CUENTA_REPARTIDOR')")
    public ResponseEntity<List<?>> misEntregas(
            @PathVariable UUID branchId,
            @AuthenticationPrincipal CuentaPublicaPrincipal cuenta) {
        return ResponseEntity.ok(historialService.entregasDelRepartidor(cuenta));
    }
}
