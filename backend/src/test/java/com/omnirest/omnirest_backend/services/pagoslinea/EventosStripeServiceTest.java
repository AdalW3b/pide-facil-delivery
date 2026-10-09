package com.omnirest.omnirest_backend.services.pagoslinea;

import com.omnirest.omnirest_backend.domain.entities.EventoStripe;
import com.omnirest.omnirest_backend.domain.entities.EventoStripe.Estado;
import com.omnirest.omnirest_backend.repositories.EventoStripeRepository;
import com.stripe.model.Event;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.HexFormat;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** Webhook de pagos en linea: firma obligatoria, sin duplicados y con reintentos. */
class EventosStripeServiceTest {

    private static final String SECRETO = "whsec_connect_prueba";
    private static final String EVENTO = "{\"id\":\"evt_123\",\"object\":\"event\",\"type\":\"payment_intent.succeeded\","
            + "\"account\":\"acct_1ABC\",\"livemode\":false,\"data\":{\"object\":{}}}";

    private final EventoStripeRepository repo = mock(EventoStripeRepository.class);

    private EventosStripeService servicio(String secreto, ManejadorEventoStripe... manejadores) {
        EventosStripeService s = new EventosStripeService(repo, List.of(manejadores));
        ReflectionTestUtils.setField(s, "secreto", secreto);
        return s;
    }

    private static String firmar(String payload, String secreto) throws Exception {
        long t = System.currentTimeMillis() / 1000;
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(secreto.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
        return "t=" + t + ",v1=" + HexFormat.of().formatHex(mac.doFinal((t + "." + payload).getBytes(StandardCharsets.UTF_8)));
    }

    private static ManejadorEventoStripe manejador(String tipo, Runnable accion) {
        return new ManejadorEventoStripe() {
            public Set<String> tipos() { return Set.of(tipo); }
            public void manejar(Event evento) { accion.run(); }
        };
    }

    private void enCola(int intentos) {
        when(repo.reclamar(eq("evt_123"), any())).thenReturn(1);
        when(repo.findById("evt_123")).thenReturn(Optional.of(EventoStripe.builder()
                .id("evt_123").tipo("payment_intent.succeeded").cuenta("acct_1ABC").livemode(false)
                .payload(EVENTO).estado(Estado.PROCESANDO).intentos(intentos)
                .proximoIntento(LocalDateTime.now()).recibidoEn(LocalDateTime.now()).build()));
    }

    @Test
    @DisplayName("Sin secreto, sin firma o con firma falsa no se guarda nada")
    void rechazos() throws Exception {
        assertThrows(IllegalStateException.class, () -> servicio("").recibir(EVENTO, firmar(EVENTO, SECRETO)));
        EventosStripeService s = servicio(SECRETO);
        assertThrows(IllegalArgumentException.class, () -> s.recibir(EVENTO, null));
        assertThrows(IllegalArgumentException.class, () -> s.recibir(EVENTO, firmar(EVENTO, "whsec_otro")));
        assertThrows(IllegalArgumentException.class, () -> s.recibir(EVENTO.replace("acct_1ABC", "acct_OTRO"), firmar(EVENTO, SECRETO)));
        verifyNoInteractions(repo);
    }

    @Test
    @DisplayName("Un evento firmado se guarda con su cuenta; si Stripe lo repite, no se vuelve a procesar")
    void guardaUnaVez() throws Exception {
        EventosStripeService s = servicio(SECRETO);
        when(repo.guardarSiNuevo(eq("evt_123"), eq("payment_intent.succeeded"), eq("acct_1ABC"), eq(false), eq(EVENTO), any()))
                .thenReturn(1, 0);
        assertTrue(s.recibir(EVENTO, firmar(EVENTO, SECRETO)));
        assertFalse(s.recibir(EVENTO, firmar(EVENTO, SECRETO)));
    }

    @Test
    @DisplayName("Sin manejador para el tipo, queda IGNORADO")
    void ignorado() {
        enCola(0);
        servicio(SECRETO).intentar("evt_123");
        verify(repo).terminar(eq("evt_123"), eq(Estado.IGNORADO), any());
    }

    @Test
    @DisplayName("El manejador recibe el evento con su cuenta y queda PROCESADO")
    void procesado() {
        enCola(0);
        AtomicReference<Boolean> llamado = new AtomicReference<>(false);
        servicio(SECRETO, manejador("payment_intent.succeeded", () -> llamado.set(true))).intentar("evt_123");
        assertTrue(llamado.get());
        verify(repo).terminar(eq("evt_123"), eq(Estado.PROCESADO), any());
    }

    @Test
    @DisplayName("Si falla se reintenta mas tarde; al acabarse los intentos queda FALLIDO")
    void reintentos() {
        ManejadorEventoStripe falla = manejador("payment_intent.succeeded", () -> { throw new RuntimeException("base caida"); });

        enCola(0);
        LocalDateTime antes = LocalDateTime.now();
        servicio(SECRETO, falla).intentar("evt_123");
        verify(repo).fallo(eq("evt_123"), eq(Estado.PENDIENTE),
                argThat(p -> !p.isBefore(antes.plusMinutes(1)) && p.isBefore(antes.plusMinutes(2))),
                contains("base caida"));

        reset(repo);
        enCola(EventosStripeService.ESPERAS_MIN.length);
        servicio(SECRETO, falla).intentar("evt_123");
        verify(repo).fallo(eq("evt_123"), eq(Estado.FALLIDO), any(), contains("base caida"));
    }

    @Test
    @DisplayName("Si otro hilo ya lo tomo, no se procesa dos veces")
    void yaTomado() {
        when(repo.reclamar(eq("evt_123"), any())).thenReturn(0);
        servicio(SECRETO, manejador("payment_intent.succeeded", () -> fail("no debia procesarse"))).intentar("evt_123");
        verify(repo, never()).terminar(any(), any(), any());
    }

    @Test
    @DisplayName("Dos manejadores para el mismo evento es un error de arranque")
    void manejadoresDuplicados() {
        assertThrows(IllegalStateException.class, () -> servicio(SECRETO,
                manejador("account.updated", () -> {}), manejador("account.updated", () -> {})));
    }
}
