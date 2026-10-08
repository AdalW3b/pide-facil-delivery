package com.omnirest.omnirest_backend.controllers;

import com.omnirest.omnirest_backend.dtos.CajaDTOs;
import com.omnirest.omnirest_backend.security.CustomUserDetails;
import com.omnirest.omnirest_backend.services.CajaService;
import com.omnirest.omnirest_backend.services.MostradorService;
import com.omnirest.omnirest_backend.services.SecurityValidationService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * La caja de la sucursal: abrirla, mover efectivo, cerrarla con arqueo y
 * cobrar las cuentas de las mesas.
 */
@RestController
@RequestMapping("/api/v1/branches/{branchId}")
@RequiredArgsConstructor
public class CajaController {

    private final CajaService cajaService;
    private final MostradorService mostradorService;
    private final SecurityValidationService securityValidationService;

    /** La caja abierta (sin ventas: el cierre es a ciegas); 204 si esta cerrada. */
    @GetMapping("/caja")
    @PreAuthorize("hasAnyAuthority('SUPER_ADMIN', 'SYSTEM_ADMIN', 'CAJA_OPERAR')")
    public ResponseEntity<CajaDTOs.EstadoCaja> estado(@PathVariable UUID branchId) {
        securityValidationService.validateUserAccessToBranch(branchId);
        return cajaService.estado(branchId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.noContent().build());
    }

    /** Si hay caja abierta. Lo consultan el mesero antes de cobrar e Inventario antes de pagar una compra con efectivo. */
    @GetMapping("/caja/abierta")
    @PreAuthorize("hasAnyAuthority('SUPER_ADMIN', 'SYSTEM_ADMIN', 'CAJA_OPERAR', 'ORDERS_UPDATE', 'TABLES_UPDATE', 'INVENTORY_UPDATE', 'CATALOG_UPDATE')")
    public ResponseEntity<Map<String, Boolean>> abierta(@PathVariable UUID branchId) {
        securityValidationService.validateUserAccessToBranch(branchId);
        return ResponseEntity.ok(Map.of("abierta", cajaService.abierta(branchId).isPresent()));
    }

    @PostMapping("/caja/abrir")
    @PreAuthorize("hasAnyAuthority('SUPER_ADMIN', 'SYSTEM_ADMIN', 'CAJA_OPERAR')")
    public ResponseEntity<CajaDTOs.EstadoCaja> abrir(@PathVariable UUID branchId,
                                                     @Valid @RequestBody CajaDTOs.AbrirCaja peticion,
                                                     @AuthenticationPrincipal CustomUserDetails user) {
        securityValidationService.validateUserAccessToBranch(branchId);
        return ResponseEntity.ok(cajaService.abrir(branchId, peticion.fondoInicial(), user));
    }

    /** Efectivo que entra o sale sin ser venta: cambio, retiros, gastos. */
    @PostMapping("/caja/movimientos")
    @PreAuthorize("hasAnyAuthority('SUPER_ADMIN', 'SYSTEM_ADMIN', 'CAJA_OPERAR')")
    public ResponseEntity<CajaDTOs.MovimientoDTO> movimiento(@PathVariable UUID branchId,
                                                             @Valid @RequestBody CajaDTOs.NuevoMovimiento peticion,
                                                             @AuthenticationPrincipal CustomUserDetails user) {
        securityValidationService.validateUserAccessToBranch(branchId);
        return ResponseEntity.ok(cajaService.registrarMovimiento(branchId, peticion, user));
    }

    /** Cierra con lo contado y devuelve el arqueo. */
    @PostMapping("/caja/cerrar")
    @PreAuthorize("hasAnyAuthority('SUPER_ADMIN', 'SYSTEM_ADMIN', 'CAJA_OPERAR')")
    public ResponseEntity<CajaDTOs.Arqueo> cerrar(@PathVariable UUID branchId,
                                                  @Valid @RequestBody CajaDTOs.CerrarCaja peticion,
                                                  @AuthenticationPrincipal CustomUserDetails user) {
        securityValidationService.validateUserAccessToBranch(branchId);
        return ResponseEntity.ok(cajaService.cerrar(branchId, peticion, user));
    }

    @GetMapping("/caja/turnos")
    @PreAuthorize("hasAnyAuthority('SUPER_ADMIN', 'SYSTEM_ADMIN', 'CAJA_OPERAR')")
    public ResponseEntity<List<CajaDTOs.TurnoResumen>> historial(@PathVariable UUID branchId) {
        securityValidationService.validateUserAccessToBranch(branchId);
        return ResponseEntity.ok(cajaService.historial(branchId));
    }

    @GetMapping("/caja/turnos/{turnoId}")
    @PreAuthorize("hasAnyAuthority('SUPER_ADMIN', 'SYSTEM_ADMIN', 'CAJA_OPERAR')")
    public ResponseEntity<CajaDTOs.Arqueo> arqueo(@PathVariable UUID branchId, @PathVariable UUID turnoId) {
        securityValidationService.validateUserAccessToBranch(branchId);
        return ResponseEntity.ok(cajaService.arqueo(branchId, turnoId));
    }

    /**
     * Cobra una cuenta (uno o varios metodos). Una mesa se cierra; un pedido de
     * mostrador queda pagado y, si es del kiosko, entra a cocina.
     */
    @PostMapping("/orders/{orderId}/cobrar")
    @PreAuthorize("hasAnyAuthority('SUPER_ADMIN', 'SYSTEM_ADMIN', 'ORDERS_UPDATE', 'TABLES_UPDATE')")
    public ResponseEntity<CajaDTOs.CobroResultado> cobrar(@PathVariable UUID branchId,
                                                          @PathVariable UUID orderId,
                                                          @Valid @RequestBody CajaDTOs.Cobrar peticion,
                                                          @AuthenticationPrincipal CustomUserDetails user) {
        securityValidationService.validateUserAccessToBranch(branchId);
        return ResponseEntity.ok(mostradorService.cobrar(branchId, orderId, peticion.pagos(), user));
    }
}
