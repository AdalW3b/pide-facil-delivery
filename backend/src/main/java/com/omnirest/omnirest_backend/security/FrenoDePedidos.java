package com.omnirest.omnirest_backend.security;

import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Frena a quien manda pedidos a domicilio en serie desde el menu en linea.
 *
 * El menu es publico y cada pedido le suena al mostrador, aparta inventario y
 * le escribe al cliente por WhatsApp: sin freno, alguien podria llenar el
 * tablero de pedidos falsos. El limite por IP es holgado para una familia que
 * pide desde la misma red; el de pedidos sin confirmar por telefono lo pone
 * DeliveryService, que ve la base.
 *
 * Vive en memoria, como FrenoDeIntentos: con una sola instancia basta.
 */
@Slf4j
@Component
public class FrenoDePedidos {

    /** Pedidos permitidos desde una misma IP dentro de la ventana. */
    public static final int PEDIDOS_POR_IP = 8;
    private static final Duration VENTANA = Duration.ofMinutes(30);

    private final ConcurrentHashMap<String, Deque<Instant>> porIp = new ConcurrentHashMap<>();

    /** Rechaza con 429 si esa IP ya mando demasiados pedidos. */
    public void comprobar(String ip) {
        if (ip == null) return;
        Instant limite = Instant.now().minus(VENTANA);
        Deque<Instant> recientes = porIp.get(ip);
        if (recientes == null) return;
        synchronized (recientes) {
            while (!recientes.isEmpty() && recientes.peekFirst().isBefore(limite)) recientes.pollFirst();
            if (recientes.size() >= PEDIDOS_POR_IP) {
                log.warn("Freno de pedidos: {} mando {} pedidos en {} minutos", ip, recientes.size(), VENTANA.toMinutes());
                throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,
                        "Recibimos muchos pedidos desde tu conexión. Espera unos minutos o llámanos.");
            }
        }
    }

    /** Cuenta un pedido creado desde esa IP. */
    public void registrar(String ip) {
        if (ip == null) return;
        Deque<Instant> recientes = porIp.computeIfAbsent(ip, k -> new ArrayDeque<>());
        synchronized (recientes) {
            recientes.addLast(Instant.now());
        }
    }
}
