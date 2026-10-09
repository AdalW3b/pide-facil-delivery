package com.omnirest.omnirest_backend.services.pagoslinea;

import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import com.stripe.exception.StripeException;
import com.stripe.model.Event;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.Set;

/** Stripe avisa una devolucion (aunque se haya hecho en su panel) o una disputa del cliente. */
@Component
@RequiredArgsConstructor
public class ReembolsoODisputaEvento implements ManejadorEventoStripe {

    private final TransaccionesLineaService transacciones;

    @Override
    public Set<String> tipos() {
        return Set.of("charge.refunded", "charge.dispute.created");
    }

    @Override
    public void manejar(Event evento) {
        if (evento.getAccount() == null) return;
        JsonObject objeto = JsonParser.parseString(evento.getDataObjectDeserializer().getRawJson()).getAsJsonObject();
        String paymentIntent = texto(objeto.get("payment_intent"));
        if (paymentIntent == null) return;
        if ("charge.refunded".equals(evento.getType())) {
            try {
                transacciones.sincronizarReembolsos(evento.getAccount(), paymentIntent);
            } catch (StripeException e) {
                throw new IllegalStateException("No se pudieron leer las devoluciones en Stripe", e);
            }
        } else {
            long monto = objeto.has("amount") ? objeto.get("amount").getAsLong() : 0;
            transacciones.disputa(evento.getAccount(), paymentIntent, monto, texto(objeto.get("reason")));
        }
    }

    private static String texto(JsonElement e) {
        return e == null || e.isJsonNull() ? null : e.getAsString();
    }
}
