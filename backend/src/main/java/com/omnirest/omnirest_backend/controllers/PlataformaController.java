package com.omnirest.omnirest_backend.controllers;

import com.omnirest.omnirest_backend.security.CustomUserDetails;
import com.omnirest.omnirest_backend.services.RentaService;
import com.omnirest.omnirest_backend.services.SoporteService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

/**
 * Lo del operador de la plataforma: el modo soporte y la renta del sistema.
 * Todo bajo /api/v1/system, que el candado del modo soporte deja pasar.
 */
@RestController
@RequestMapping("/api/v1/system")
@RequiredArgsConstructor
@PreAuthorize("hasAuthority('SYSTEM_ADMIN')")
public class PlataformaController {

    private final SoporteService soporteService;
    private final RentaService rentaService;
    private final com.omnirest.omnirest_backend.services.asistente.AsistenteService asistenteService;
    private final com.omnirest.omnirest_backend.services.pagoslinea.PagosLineaService pagosLinea;

    // ------------------------------------------------------------------
    // Modo soporte
    // ------------------------------------------------------------------

    public record AbrirSesion(UUID restaurantId, String motivo) {
    }

    public record Codigo(String codigo) {
    }

    @PostMapping("/soporte/sesiones")
    public ResponseEntity<SoporteService.SesionDTO> abrir(@RequestBody AbrirSesion peticion,
                                                          @AuthenticationPrincipal CustomUserDetails operador) {
        return ResponseEntity.ok(soporteService.abrir(operador, peticion.restaurantId(), peticion.motivo()));
    }

    /** La sesión abierta del operador; 204 si no tiene. */
    @GetMapping("/soporte/sesiones/activa")
    public ResponseEntity<SoporteService.SesionDTO> activa(@AuthenticationPrincipal CustomUserDetails operador) {
        return soporteService.activa(operador).map(ResponseEntity::ok).orElse(ResponseEntity.noContent().build());
    }

    @PostMapping("/soporte/sesiones/terminar")
    public ResponseEntity<Void> terminar(@AuthenticationPrincipal CustomUserDetails operador) {
        soporteService.terminar(operador);
        return ResponseEntity.noContent().build();
    }

    /** El código que dictó el dueño: abre la ventana de cambios. */
    @PostMapping("/soporte/sesiones/cambios")
    public ResponseEntity<SoporteService.SesionDTO> autorizarCambios(@RequestBody Codigo peticion,
                                                                     @AuthenticationPrincipal CustomUserDetails operador) {
        return ResponseEntity.ok(soporteService.autorizarCambios(operador, peticion.codigo()));
    }

    @GetMapping("/soporte/bitacora")
    public ResponseEntity<List<SoporteService.Bitacora>> bitacora(@RequestParam(required = false) UUID restaurante) {
        return ResponseEntity.ok(soporteService.bitacora(restaurante));
    }

    // ------------------------------------------------------------------
    // Pagos en linea: la comision de Pide Facil, segun el trato con cada dueño
    // ------------------------------------------------------------------

    public record Comision(java.math.BigDecimal porcentaje) {
    }

    @GetMapping("/pagos-linea/{restaurantId}")
    public ResponseEntity<com.omnirest.omnirest_backend.services.pagoslinea.PagosLineaService.Estado> pagosLinea(
            @PathVariable UUID restaurantId) {
        return ResponseEntity.ok(pagosLinea.estadoDe(restaurantId));
    }

    @PutMapping("/pagos-linea/{restaurantId}/comision")
    public ResponseEntity<com.omnirest.omnirest_backend.services.pagoslinea.PagosLineaService.Estado> comision(
            @PathVariable UUID restaurantId, @RequestBody Comision peticion,
            @AuthenticationPrincipal CustomUserDetails operador) {
        return ResponseEntity.ok(pagosLinea.fijarComision(restaurantId, peticion.porcentaje(), operador));
    }

    @GetMapping("/pagos-linea/{restaurantId}/bitacora")
    public ResponseEntity<List<com.omnirest.omnirest_backend.services.pagoslinea.PagosLineaService.Movimiento>> bitacoraPagos(
            @PathVariable UUID restaurantId) {
        return ResponseEntity.ok(pagosLinea.bitacoraDe(restaurantId));
    }

    // ------------------------------------------------------------------
    // Renta
    // ------------------------------------------------------------------

    public record Anular(String motivo) {
    }

    @GetMapping("/renta/resumen")
    public ResponseEntity<RentaService.Resumen> resumen() {
        return ResponseEntity.ok(rentaService.resumen());
    }

    @GetMapping("/renta/cobros")
    public ResponseEntity<List<RentaService.CobroDTO>> historial(@RequestParam UUID restaurante) {
        return ResponseEntity.ok(rentaService.historial(restaurante));
    }

    @PostMapping("/renta/cobros/efectivo")
    public ResponseEntity<RentaService.CobroDTO> registrarEfectivo(@RequestBody RentaService.NuevoPagoEfectivo pago,
                                                                   @AuthenticationPrincipal CustomUserDetails operador) {
        return ResponseEntity.ok(rentaService.registrarEfectivo(operador, pago));
    }

    @PatchMapping("/renta/cobros/{cobroId}/anular")
    public ResponseEntity<RentaService.CobroDTO> anular(@PathVariable UUID cobroId, @RequestBody Anular peticion,
                                                        @AuthenticationPrincipal CustomUserDetails operador) {
        return ResponseEntity.ok(rentaService.anular(operador, cobroId, peticion.motivo()));
    }

    // ------------------------------------------------------------------
    // Asistente (complemento)
    // ------------------------------------------------------------------

    public record Complemento(boolean activo) {
    }

    /** Los restaurantes que tienen el asistente contratado. */
    @GetMapping("/asistente")
    public ResponseEntity<java.util.Set<UUID>> conAsistente() {
        return ResponseEntity.ok(asistenteService.conComplemento());
    }

    @PutMapping("/asistente/{restaurantId}")
    public ResponseEntity<Complemento> activarAsistente(@PathVariable UUID restaurantId, @RequestBody Complemento peticion) {
        return ResponseEntity.ok(new Complemento(asistenteService.activarComplemento(restaurantId, peticion.activo())));
    }
}
