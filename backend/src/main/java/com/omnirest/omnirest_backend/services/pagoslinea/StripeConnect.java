package com.omnirest.omnirest_backend.services.pagoslinea;

import com.stripe.exception.StripeException;
import com.stripe.model.Account;
import com.stripe.model.AccountLink;
import com.stripe.model.PaymentIntent;
import com.stripe.net.RequestOptions;
import com.stripe.param.AccountCreateParams;
import com.stripe.param.AccountLinkCreateParams;
import com.stripe.param.PaymentIntentCancelParams;
import com.stripe.param.PaymentIntentCreateParams;
import com.stripe.param.PaymentIntentRetrieveParams;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.UUID;

/**
 * Las llamadas a Stripe Connect con la llave de la plataforma. Cada llamada
 * lleva su llave: no se toca Stripe.apiKey, que es la de la renta.
 */
@Component
public class StripeConnect {

    @Value("${stripe.connect-secret-key:}")
    private String llave;

    @Value("${stripe.connect-publishable-key:}")
    private String llavePublica;

    /** La que usa el navegador para el formulario de tarjeta. No es secreta. */
    public String llavePublica() {
        return llavePublica != null && llavePublica.startsWith("pk_") ? llavePublica : null;
    }

    public boolean configurado() {
        return llave != null && (llave.startsWith("sk_") || llave.startsWith("rk_"));
    }

    /** Con llave de prueba las cuentas y los cobros son de prueba: sin dinero real. */
    public boolean modoPrueba() {
        return llave == null || !llave.contains("_live_");
    }

    RequestOptions opciones() {
        if (!configurado()) {
            throw new IllegalStateException("Los pagos en línea no están configurados en el servidor.");
        }
        return RequestOptions.builder().setApiKey(llave).build();
    }

    /** Opciones para actuar en la cuenta del restaurante (cargo directo). */
    RequestOptions opciones(String cuenta) {
        if (!configurado()) {
            throw new IllegalStateException("Los pagos en línea no están configurados en el servidor.");
        }
        return RequestOptions.builder().setApiKey(llave).setStripeAccount(cuenta).build();
    }

    /**
     * Cuenta del restaurante con el panel completo de Stripe: cobra directo,
     * paga la comision de Stripe y Stripe responde por las perdidas (no Pide Facil).
     */
    public Account crearCuenta(UUID restaurantId, String nombre) throws StripeException {
        AccountCreateParams params = AccountCreateParams.builder()
                .setCountry("MX")
                .setController(AccountCreateParams.Controller.builder()
                        .setFees(AccountCreateParams.Controller.Fees.builder()
                                .setPayer(AccountCreateParams.Controller.Fees.Payer.ACCOUNT).build())
                        .setLosses(AccountCreateParams.Controller.Losses.builder()
                                .setPayments(AccountCreateParams.Controller.Losses.Payments.STRIPE).build())
                        .setStripeDashboard(AccountCreateParams.Controller.StripeDashboard.builder()
                                .setType(AccountCreateParams.Controller.StripeDashboard.Type.FULL).build())
                        .build())
                .setBusinessProfile(AccountCreateParams.BusinessProfile.builder()
                        .setName(nombre)
                        .setMcc("5812") // Restaurantes
                        .build())
                .putMetadata("restaurant_id", restaurantId.toString())
                .build();
        return Account.create(params, opciones());
    }

    /** La liga de un solo uso a las paginas de alta de Stripe. */
    public String ligaDeAlta(String cuenta, String urlRenovar, String urlRegreso) throws StripeException {
        AccountLinkCreateParams params = AccountLinkCreateParams.builder()
                .setAccount(cuenta)
                .setType(AccountLinkCreateParams.Type.ACCOUNT_ONBOARDING)
                .setRefreshUrl(urlRenovar)
                .setReturnUrl(urlRegreso)
                .build();
        return AccountLink.create(params, opciones()).getUrl();
    }

    public Account cuenta(String cuenta) throws StripeException {
        return Account.retrieve(cuenta, opciones());
    }

    /**
     * El cobro en la cuenta del restaurante (cargo directo). La misma clave de
     * idempotencia devuelve el mismo cobro: un reintento nunca cobra doble.
     *
     * @param comisionCentavos lo que se queda Pide Facil; 0 = nada
     */
    public PaymentIntent crearCobro(String cuenta, long centavos, long comisionCentavos, String descripcion,
                                    Map<String, String> metadata, String idempotencia) throws StripeException {
        PaymentIntentCreateParams.Builder params = PaymentIntentCreateParams.builder()
                .setAmount(centavos)
                .setCurrency("mxn")
                .addPaymentMethodType("card")
                .setDescription(descripcion)
                .putAllMetadata(metadata);
        if (comisionCentavos > 0) {
            params.setApplicationFeeAmount(comisionCentavos);
        }
        RequestOptions opciones = RequestOptions.builder().setApiKey(llaveExigida()).setStripeAccount(cuenta)
                .setIdempotencyKey(idempotencia).build();
        return PaymentIntent.create(params.build(), opciones);
    }

    /** El cobro con su cargo y la comision de Stripe, para saber la tarjeta y lo que cobro Stripe. */
    public PaymentIntent cobro(String cuenta, String paymentIntentId) throws StripeException {
        PaymentIntentRetrieveParams params = PaymentIntentRetrieveParams.builder()
                .addExpand("latest_charge")
                .addExpand("latest_charge.balance_transaction")
                .build();
        return PaymentIntent.retrieve(paymentIntentId, params, opciones(cuenta));
    }

    public PaymentIntent cancelarCobro(String cuenta, String paymentIntentId) throws StripeException {
        PaymentIntent pi = PaymentIntent.retrieve(paymentIntentId, opciones(cuenta));
        return pi.cancel(PaymentIntentCancelParams.builder()
                .setCancellationReason(PaymentIntentCancelParams.CancellationReason.ABANDONED).build(), opciones(cuenta));
    }

    private String llaveExigida() {
        if (!configurado()) {
            throw new IllegalStateException("Los pagos en línea no están configurados en el servidor.");
        }
        return llave;
    }
}
