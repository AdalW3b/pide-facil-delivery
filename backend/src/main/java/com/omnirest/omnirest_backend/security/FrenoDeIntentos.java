package com.omnirest.omnirest_backend.security;

import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

import java.time.Duration;
import java.time.Instant;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Frena a quien prueba contrasenas una tras otra.
 *
 * Detras de una cuenta de cliente hay direcciones y el pin de su casa; detras
 * de una del personal, el restaurante entero. Sin freno, una contrasena de 8
 * caracteres se adivina a fuerza de intentos.
 *
 * Se cuentan dos cosas por separado:
 * - la cuenta atacada, para que nadie pruebe cientos de contrasenas contra un
 *   mismo numero o usuario;
 * - la direccion IP, para que tampoco pueda probar unas pocas contra cada uno
 *   de muchos numeros distintos.
 *
 * Vive en memoria: con una sola instancia del backend basta, y un reinicio solo
 * perdona los bloqueos en curso. Si algun dia hay varias instancias, esto tiene
 * que pasar a la base o a Redis.
 */
@Slf4j
@Component
public class FrenoDeIntentos {

    /** Fallos permitidos contra una misma cuenta dentro de la ventana. */
    public static final int FALLOS_POR_CUENTA = 5;
    /** Fallos permitidos desde una misma IP, sumando todas las cuentas. */
    public static final int FALLOS_POR_IP = 20;
    private static final Duration VENTANA = Duration.ofMinutes(15);
    private static final Duration BLOQUEO = Duration.ofMinutes(15);

    private final ConcurrentHashMap<String, Registro> registros = new ConcurrentHashMap<>();

    private static final class Registro {
        int fallos;
        Instant desde;
        Instant bloqueadoHasta;
    }

    /**
     * Rechaza con 429 si la cuenta o la IP estan bloqueadas. Va antes de
     * comprobar la contrasena: si no, un bloqueo no impediria seguir probando,
     * solo ocultaria cuando se acierta.
     */
    public void comprobar(String cuenta, String ip) {
        Instant ahora = Instant.now();
        Instant hasta = mayor(bloqueadoHasta(cuenta, ahora), bloqueadoHasta(ip, ahora));
        if (hasta != null) {
            long minutos = Math.max(1, Duration.between(ahora, hasta).toMinutes() + 1);
            String mensaje = "Demasiados intentos fallidos. Espera " + minutos
                    + (minutos == 1 ? " minuto" : " minutos") + " antes de volver a intentar.";
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, mensaje);
        }
    }

    /** Suma un fallo a la cuenta y a la IP. */
    public void fallo(String cuenta, String ip) {
        sumar(cuenta, FALLOS_POR_CUENTA);
        sumar(ip, FALLOS_POR_IP);
    }

    /**
     * Entro bien: se olvidan los fallos de la cuenta. Los de la IP se quedan,
     * para que acertar en una cuenta propia no sirva para seguir probando en
     * ajenas.
     */
    public void exito(String cuenta) {
        if (cuenta != null) registros.remove(cuenta);
    }

    private void sumar(String clave, int maximo) {
        if (clave == null) return;
        Instant ahora = Instant.now();
        registros.compute(clave, (k, r) -> {
            if (r == null || r.desde.plus(VENTANA).isBefore(ahora)) {
                r = new Registro();
                r.desde = ahora;
            }
            r.fallos++;
            if (r.fallos >= maximo && r.bloqueadoHasta == null) {
                r.bloqueadoHasta = ahora.plus(BLOQUEO);
                log.warn("Bloqueo por intentos fallidos: {} ({} fallos)", k, r.fallos);
            }
            return r;
        });
    }

    private Instant bloqueadoHasta(String clave, Instant ahora) {
        if (clave == null) return null;
        Registro r = registros.get(clave);
        if (r == null || r.bloqueadoHasta == null) return null;
        return r.bloqueadoHasta.isAfter(ahora) ? r.bloqueadoHasta : null;
    }

    private static Instant mayor(Instant a, Instant b) {
        if (a == null) return b;
        if (b == null) return a;
        return a.isAfter(b) ? a : b;
    }

    /** Tira lo vencido para que el mapa no crezca sin fin. */
    @Scheduled(fixedDelay = 10 * 60 * 1000)
    void limpiar() {
        Instant ahora = Instant.now();
        registros.entrySet().removeIf(e -> {
            Registro r = e.getValue();
            boolean ventanaVencida = r.desde.plus(VENTANA).isBefore(ahora);
            boolean sinBloqueo = r.bloqueadoHasta == null || r.bloqueadoHasta.isBefore(ahora);
            return ventanaVencida && sinBloqueo;
        });
    }

    // Claves: cada tipo de cuenta en su propio espacio, para que un usuario del
    // personal y un telefono no choquen.

    public static String clavePersonal(String username) {
        return username == null ? null : "personal:" + username.trim().toLowerCase();
    }

    public static String claveCuenta(Object restaurantId, Object tipo, String telefono) {
        return "cuenta:" + restaurantId + ":" + tipo + ":" + telefono;
    }

    public static String claveIp(String ip) {
        return ip == null || ip.isBlank() ? null : "ip:" + ip;
    }
}
