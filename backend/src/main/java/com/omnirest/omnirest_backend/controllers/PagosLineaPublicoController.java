package com.omnirest.omnirest_backend.controllers;

import com.omnirest.omnirest_backend.services.pagoslinea.CobrosLineaService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

/**
 * El menu en linea pregunta como va el pago del cliente. El ID de la
 * transaccion solo lo conoce quien hizo el pedido, como el token de seguimiento.
 */
@RestController
@RequestMapping("/api/v1/public/pagos-linea")
@RequiredArgsConstructor
public class PagosLineaPublicoController {

    private final CobrosLineaService cobros;

    @GetMapping("/{transaccionId}")
    public ResponseEntity<CobrosLineaService.EstadoPago> estado(@PathVariable UUID transaccionId) {
        return ResponseEntity.ok(cobros.estado(transaccionId));
    }
}
