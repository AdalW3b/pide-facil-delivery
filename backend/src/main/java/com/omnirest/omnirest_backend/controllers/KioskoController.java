package com.omnirest.omnirest_backend.controllers;

import com.omnirest.omnirest_backend.domain.entities.Kiosko;
import com.omnirest.omnirest_backend.dtos.PedidoMostradorDTOs;
import com.omnirest.omnirest_backend.repositories.BranchRepository;
import com.omnirest.omnirest_backend.security.CustomUserDetails;
import com.omnirest.omnirest_backend.security.FrenoDePedidos;
import com.omnirest.omnirest_backend.services.DeliveryService;
import com.omnirest.omnirest_backend.services.KioskoService;
import com.omnirest.omnirest_backend.services.SecurityValidationService;
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
 * Pedidos de mostrador: el kiosko de la sucursal y "paso a recoger" desde el
 * celular. El kiosko se activa desde el panel y se identifica con el
 * encabezado {@code X-Kiosko-Token} en cada pedido.
 */
@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
public class KioskoController {

    private static final String ENCABEZADO = "X-Kiosko-Token";

    private final KioskoService kioskoService;
    private final DeliveryService deliveryService;
    private final BranchRepository branchRepository;
    private final SecurityValidationService securityValidationService;
    private final FrenoDePedidos frenoDePedidos;

    // ------------------------------------------------------------------
    // Panel: activar y apagar kioscos
    // ------------------------------------------------------------------

    public record ActivarKiosko(String nombre) {
    }

    /** Activa la tablet desde la que se llama. El token solo se devuelve aqui. */
    @PostMapping("/branches/{branchId}/kioscos")
    @PreAuthorize("hasAnyAuthority('SUPER_ADMIN', 'SYSTEM_ADMIN', 'BRANCH_UPDATE', 'CAJA_OPERAR')")
    public ResponseEntity<KioskoService.Activado> activar(@PathVariable UUID branchId,
                                                          @RequestBody(required = false) ActivarKiosko peticion,
                                                          @AuthenticationPrincipal CustomUserDetails user) {
        securityValidationService.validateUserAccessToBranch(branchId);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(kioskoService.activar(branchId, peticion != null ? peticion.nombre() : null, user));
    }

    @GetMapping("/branches/{branchId}/kioscos")
    @PreAuthorize("hasAnyAuthority('SUPER_ADMIN', 'SYSTEM_ADMIN', 'BRANCH_UPDATE', 'CAJA_OPERAR')")
    public ResponseEntity<List<KioskoService.KioskoDTO>> listar(@PathVariable UUID branchId) {
        securityValidationService.validateUserAccessToBranch(branchId);
        return ResponseEntity.ok(kioskoService.listar(branchId));
    }

    @DeleteMapping("/branches/{branchId}/kioscos/{kioskoId}")
    @PreAuthorize("hasAnyAuthority('SUPER_ADMIN', 'SYSTEM_ADMIN', 'BRANCH_UPDATE', 'CAJA_OPERAR')")
    public ResponseEntity<Void> desactivar(@PathVariable UUID branchId, @PathVariable UUID kioskoId) {
        securityValidationService.validateUserAccessToBranch(branchId);
        kioskoService.desactivar(branchId, kioskoId);
        return ResponseEntity.noContent().build();
    }

    // ------------------------------------------------------------------
    // Kiosko (publico, con token)
    // ------------------------------------------------------------------

    /** La tablet pregunta si sigue activa; devuelve con que nombre se muestra. */
    @GetMapping("/public/branches/{branchId}/kiosko")
    public ResponseEntity<Map<String, String>> kiosko(@PathVariable UUID branchId,
                                                      @RequestHeader(value = ENCABEZADO, required = false) String token) {
        Kiosko kiosko = kioskoService.validar(branchId, token);
        String restaurante = branchRepository.findById(branchId)
                .map(b -> b.getRestaurant() != null ? b.getRestaurant().getName() : b.getName())
                .orElse("");
        return ResponseEntity.ok(Map.of("nombre", kiosko.getNombre(), "restaurante", restaurante));
    }

    @PostMapping("/public/branches/{branchId}/kiosko/orders")
    public ResponseEntity<PedidoMostradorDTOs.Creado> pedirEnKiosko(
            @PathVariable UUID branchId,
            @RequestHeader(value = ENCABEZADO, required = false) String token,
            @Valid @RequestBody PedidoMostradorDTOs.Crear peticion) {
        Kiosko kiosko = kioskoService.validar(branchId, token);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(deliveryService.crearPedidoMostrador(branchId, peticion, kiosko));
    }

    // ------------------------------------------------------------------
    // Paso a recoger (publico, desde el celular)
    // ------------------------------------------------------------------

    @PostMapping("/public/branches/{branchId}/recoger/orders")
    public ResponseEntity<PedidoMostradorDTOs.Creado> pedirParaRecoger(
            @PathVariable UUID branchId,
            @Valid @RequestBody PedidoMostradorDTOs.Crear peticion,
            HttpServletRequest http) {
        // Igual que el menu a domicilio: se frena a quien manda pedidos en serie.
        String ip = http.getRemoteAddr();
        frenoDePedidos.comprobar(ip);
        deliveryService.exigirSinDemasiadosPendientes(branchId, peticion.telefono());
        PedidoMostradorDTOs.Creado creado = deliveryService.crearPedidoMostrador(branchId, peticion, null);
        frenoDePedidos.registrar(ip);
        return ResponseEntity.status(HttpStatus.CREATED).body(creado);
    }
}
