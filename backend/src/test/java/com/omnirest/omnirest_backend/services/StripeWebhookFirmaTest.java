package com.omnirest.omnirest_backend.services;

import com.omnirest.omnirest_backend.repositories.RestaurantRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.util.HexFormat;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/** El webhook de la renta solo acepta eventos firmados por Stripe. */
class StripeWebhookFirmaTest {

    private static final String SECRETO = "whsec_prueba_123";
    private static final String EVENTO = "{\"id\":\"evt_1\",\"object\":\"event\",\"type\":\"ping.prueba\",\"data\":{\"object\":{}}}";

    private final RestaurantRepository restaurantes = mock(RestaurantRepository.class);
    private final RentaService renta = mock(RentaService.class);

    private StripeBillingService servicio(String secreto) {
        StripeBillingService s = new StripeBillingService(restaurantes, renta);
        ReflectionTestUtils.setField(s, "stripeWebhookSecret", secreto);
        return s;
    }

    /** La firma que pone Stripe: t=<segundos>,v1=HMAC-SHA256("t.payload"). */
    private static String firmar(String payload, String secreto) throws Exception {
        long t = System.currentTimeMillis() / 1000;
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(secreto.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
        String v1 = HexFormat.of().formatHex(mac.doFinal((t + "." + payload).getBytes(StandardCharsets.UTF_8)));
        return "t=" + t + ",v1=" + v1;
    }

    @Test
    @DisplayName("Sin secreto configurado no se procesa nada")
    void sinSecreto() {
        assertThrows(IllegalStateException.class, () -> servicio("").processWebhook(EVENTO, "t=1,v1=abc"));
        assertThrows(IllegalStateException.class, () -> servicio("whsec_placeholder").processWebhook(EVENTO, "t=1,v1=abc"));
    }

    @Test
    @DisplayName("Sin firma o con firma falsa se rechaza; con la firma de Stripe se acepta")
    void firma() throws Exception {
        StripeBillingService s = servicio(SECRETO);
        assertThrows(IllegalArgumentException.class, () -> s.processWebhook(EVENTO, null));
        assertThrows(IllegalArgumentException.class, () -> s.processWebhook(EVENTO, firmar(EVENTO, "whsec_otro")));
        assertDoesNotThrow(() -> s.processWebhook(EVENTO, firmar(EVENTO, SECRETO)));
        verifyNoInteractions(renta);
    }
}
