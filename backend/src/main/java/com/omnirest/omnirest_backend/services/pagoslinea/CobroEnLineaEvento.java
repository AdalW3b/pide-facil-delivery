package com.omnirest.omnirest_backend.services.pagoslinea;

import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import com.stripe.exception.StripeException;
import com.stripe.model.Event;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.Set;

/** Stripe avisa como va el cobro de un pedido: pagado, rechazado, en proceso o cancelado. */
@Component
@RequiredArgsConstructor
public class CobroEnLineaEvento implements ManejadorEventoStripe {

    private final CobrosLineaService cobros;

    @Override
    public Set<String> tipos() {
        return Set.of("payment_intent.succeeded", "payment_intent.payment_failed",
                "payment_intent.processing", "payment_intent.canceled");
    }

    @Override
    public void manejar(Event evento) {
        if (evento.getAccount() == null) return; // De la cuenta de la plataforma: no es de un restaurante.
        // Solo se toma el ID: el cobro se vuelve a leer en Stripe.
        JsonObject objeto = JsonParser.parseString(evento.getDataObjectDeserializer().getRawJson()).getAsJsonObject();
        try {
            cobros.alAvisoDeStripe(evento.getAccount(), objeto.get("id").getAsString());
        } catch (StripeException e) {
            throw new IllegalStateException("No se pudo leer el cobro en Stripe", e);
        }
    }
}
