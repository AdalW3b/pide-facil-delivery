package com.omnirest.omnirest_backend.services.pagoslinea;

import com.stripe.model.Event;

import java.util.Set;

/**
 * Atiende ciertos tipos de evento de Stripe ("payment_intent.succeeded",
 * "account.updated"...). Cada fase agrega los suyos como beans de Spring.
 *
 * Debe poder recibir el mismo evento dos veces y eventos fuera de orden sin
 * dejar las cosas mal: Stripe no garantiza ni una entrega ni el orden.
 */
public interface ManejadorEventoStripe {

    Set<String> tipos();

    /** Si lanza una excepcion, el evento se reintenta mas tarde. */
    void manejar(Event evento);
}
