package com.omnirest.omnirest_backend.controllers;

import com.omnirest.omnirest_backend.services.pagoslinea.EventosStripeService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * Webhook de Stripe Connect: los pagos de los clientes a los restaurantes.
 * Solo acepta eventos con la firma de Stripe. Responde en cuanto el evento
 * queda guardado; el proceso va aparte.
 */
@RestController
@RequestMapping("/api/v1/webhooks/stripe-pagos")
@RequiredArgsConstructor
public class PagosLineaWebhookController {

    private final EventosStripeService eventos;

    @PostMapping
    public ResponseEntity<String> recibir(
            @RequestBody String payload,
            @RequestHeader(value = "Stripe-Signature", required = false) String firma) {
        try {
            return ResponseEntity.ok(eventos.recibir(payload, firma) ? "Recibido" : "Repetido");
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        } catch (IllegalStateException e) {
            // Sin secreto no se procesa nada; Stripe reintenta cuando se configure.
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(e.getMessage());
        }
    }
}
