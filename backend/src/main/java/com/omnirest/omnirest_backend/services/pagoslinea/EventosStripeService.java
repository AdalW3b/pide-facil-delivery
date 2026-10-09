package com.omnirest.omnirest_backend.services.pagoslinea;

import com.omnirest.omnirest_backend.domain.entities.EventoStripe;
import com.omnirest.omnirest_backend.domain.entities.EventoStripe.Estado;
import com.omnirest.omnirest_backend.repositories.EventoStripeRepository;
import com.stripe.model.Event;
import com.stripe.net.Webhook;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;

/**
 * Los eventos de Stripe Connect: los pagos de los clientes a los restaurantes.
 *
 * Al llegar, se verifica la firma y se guarda el evento; a Stripe se le
 * responde de inmediato y el evento se procesa aparte, con reintentos. Asi un
 * error nuestro no hace que Stripe lo reintente por dias, y si Stripe manda el
 * mismo evento dos veces, se procesa una sola.
 *
 * Es otro endpoint y otro secreto que el webhook de la renta del sistema.
 */
@Service
@Slf4j
public class EventosStripeService {

    /** Espera antes de cada reintento, en minutos. Al acabarse, el evento queda FALLIDO. */
    static final int[] ESPERAS_MIN = {1, 5, 15, 60, 180, 360, 720};

    private final EventoStripeRepository repositorio;
    private final Map<String, ManejadorEventoStripe> manejadores = new HashMap<>();

    @Value("${stripe.connect-webhook-secret:}")
    private String secreto;

    /** Mientras no haya manejadores (fase 0), los eventos se guardan y quedan IGNORADO. */
    @Autowired
    public EventosStripeService(EventoStripeRepository repositorio, ObjectProvider<ManejadorEventoStripe> manejadores) {
        this(repositorio, manejadores.orderedStream().toList());
    }

    EventosStripeService(EventoStripeRepository repositorio, List<ManejadorEventoStripe> manejadores) {
        this.repositorio = repositorio;
        for (ManejadorEventoStripe m : manejadores) {
            for (String tipo : m.tipos()) {
                if (this.manejadores.put(tipo, m) != null) {
                    throw new IllegalStateException("Dos manejadores para el evento de Stripe " + tipo);
                }
            }
        }
    }

    /**
     * Recibe un evento del webhook. Sin secreto configurado o sin firma valida
     * no se guarda nada.
     *
     * @return true si es nuevo; false si Stripe ya lo habia mandado
     * @throws IllegalStateException    si falta el secreto en el servidor
     * @throws IllegalArgumentException si la firma falta o no es de Stripe
     */
    public boolean recibir(String payload, String firma) {
        if (secreto == null || secreto.isBlank() || secreto.startsWith("whsec_placeholder")) {
            log.error("Webhook de pagos en linea rechazado: falta STRIPE_CONNECT_WEBHOOK_SECRET en el servidor.");
            throw new IllegalStateException("El webhook de pagos en línea no está configurado en el servidor.");
        }
        if (firma == null || firma.isBlank()) {
            log.warn("Webhook de pagos en linea rechazado: llego sin firma de Stripe.");
            throw new IllegalArgumentException("Falta la firma de Stripe.");
        }
        Event evento;
        try {
            evento = Webhook.constructEvent(payload, firma, secreto);
        } catch (Exception e) {
            log.warn("Webhook de pagos en linea rechazado, firma invalida: {}", e.getMessage());
            throw new IllegalArgumentException("Firma de webhook inválida.");
        }

        boolean nuevo = repositorio.guardarSiNuevo(evento.getId(), evento.getType(), evento.getAccount(),
                Boolean.TRUE.equals(evento.getLivemode()), payload, LocalDateTime.now()) > 0;
        if (nuevo) {
            log.info("Evento de Stripe {} ({}) de la cuenta {}", evento.getId(), evento.getType(), evento.getAccount());
            String id = evento.getId();
            CompletableFuture.runAsync(() -> intentar(id));
        } else {
            log.info("Evento de Stripe {} repetido: ya estaba guardado", evento.getId());
        }
        return nuevo;
    }

    /** Lo que quedo pendiente o toca reintentar. Cada 30 segundos. */
    @Scheduled(fixedDelay = 30_000, initialDelay = 20_000)
    public void procesarPendientes() {
        LocalDateTime ahora = LocalDateTime.now();
        repositorio.liberarAtorados(ahora.minusMinutes(5));
        for (EventoStripe e : repositorio.findTop50ByEstadoAndProximoIntentoLessThanEqualOrderByRecibidoEnAsc(
                Estado.PENDIENTE, ahora)) {
            intentar(e.getId());
        }
    }

    /** Limpieza diaria: lo ya procesado se guarda 90 dias. */
    @Scheduled(cron = "0 45 4 * * *")
    public void limpiar() {
        int borrados = repositorio.borrarViejos(LocalDateTime.now().minusDays(90));
        if (borrados > 0) log.info("Eventos de Stripe: {} viejos borrados", borrados);
    }

    /** Un intento de procesar el evento. */
    void intentar(String id) {
        if (repositorio.reclamar(id, LocalDateTime.now()) == 0) return; // Ya no estaba pendiente u otro hilo lo tomo.
        EventoStripe registro = repositorio.findById(id).orElse(null);
        if (registro == null) return;

        ManejadorEventoStripe manejador = manejadores.get(registro.getTipo());
        if (manejador == null) {
            // Stripe manda los tipos que se elijan en su panel; si llega otro, no hay nada que hacer.
            repositorio.terminar(id, Estado.IGNORADO, LocalDateTime.now());
            return;
        }
        try {
            // La firma ya se verifico al recibirlo.
            Event evento = Event.GSON.fromJson(registro.getPayload(), Event.class);
            manejador.manejar(evento);
            repositorio.terminar(id, Estado.PROCESADO, LocalDateTime.now());
        } catch (Exception ex) {
            int intento = registro.getIntentos() + 1;
            String error = ex.getClass().getSimpleName() + ": " + ex.getMessage();
            if (error.length() > 500) error = error.substring(0, 500);
            if (intento > ESPERAS_MIN.length) {
                log.error("Evento de Stripe {} ({}) FALLIDO tras {} intentos: {}", id, registro.getTipo(), intento, error);
                repositorio.fallo(id, Estado.FALLIDO, LocalDateTime.now(), error);
            } else {
                LocalDateTime proximo = LocalDateTime.now().plusMinutes(ESPERAS_MIN[intento - 1]);
                log.warn("Evento de Stripe {} ({}) fallo, intento {}; se reintenta a las {}: {}",
                        id, registro.getTipo(), intento, proximo, error);
                repositorio.fallo(id, Estado.PENDIENTE, proximo, error);
            }
        }
    }
}
