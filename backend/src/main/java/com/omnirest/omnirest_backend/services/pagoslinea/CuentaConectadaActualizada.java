package com.omnirest.omnirest_backend.services.pagoslinea;

import com.stripe.exception.StripeException;
import com.stripe.model.Event;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.Set;

/** Stripe avisa que cambio la cuenta de un restaurante: pide datos, ya puede cobrar, la detuvo. */
@Component
@RequiredArgsConstructor
public class CuentaConectadaActualizada implements ManejadorEventoStripe {

    private final PagosLineaService pagosLinea;

    @Override
    public Set<String> tipos() {
        return Set.of("account.updated");
    }

    @Override
    public void manejar(Event evento) {
        if (evento.getAccount() == null) return; // De la cuenta de la plataforma: no es de un restaurante.
        try {
            pagosLinea.actualizarCuenta(evento.getAccount());
        } catch (StripeException e) {
            throw new IllegalStateException("No se pudo leer la cuenta " + evento.getAccount() + " en Stripe", e);
        }
    }
}
