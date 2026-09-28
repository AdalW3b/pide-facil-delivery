package com.omnirest.omnirest_backend.services;

import com.omnirest.omnirest_backend.domain.entities.MensajeWhatsapp;
import com.omnirest.omnirest_backend.domain.entities.MensajeWhatsapp.Estado;
import com.omnirest.omnirest_backend.domain.entities.MensajeWhatsapp.Motivo;
import com.omnirest.omnirest_backend.repositories.MensajeWhatsappRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;

/**
 * Todos los avisos por WhatsApp pasan por aqui.
 *
 * Antes cada modulo mandaba el suyo "al aire": si la sesion de WhatsApp de la
 * sucursal estaba caida ese minuto, el mensaje se perdia y nadie se enteraba.
 * Ahora:
 * - se guarda en la misma transaccion que el cambio que lo provoca, asi que
 *   solo sale si ese cambio de verdad se confirmo;
 * - se intenta en cuanto se confirma, y si falla se reintenta con espera
 *   creciente hasta que se envia o deja de tener sentido;
 * - un mensaje nuevo sobre lo mismo (el estado de un pedido) reemplaza a los
 *   que no alcanzaron a salir;
 * - los de un mismo destinatario salen en orden.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ColaWhatsapp {

    /** Espera entre reintentos: 15 s, 30 s, 1 min, 2 min y luego cada 5 min. */
    private static final int[] ESPERAS_SEGUNDOS = {15, 30, 60, 120, 300};

    private final MensajeWhatsappRepository repositorio;
    private final WhatsappIntegrationService whatsapp;

    /**
     * Encola un aviso. Si hay una transaccion abierta, el primer intento espera
     * a que se confirme; si se revierte, el mensaje tampoco existe.
     *
     * @param claveReemplazo mensajes con la misma clave se reemplazan entre si;
     *                       null si cada mensaje cuenta por si solo.
     */
    public void encolar(UUID branchId, String destino, String texto, Motivo motivo, String claveReemplazo) {
        if (branchId == null || destino == null || destino.isBlank() || texto == null || texto.isBlank()) {
            return;
        }
        if (claveReemplazo != null) {
            repositorio.reemplazar(claveReemplazo);
        }
        LocalDateTime ahora = LocalDateTime.now();
        MensajeWhatsapp mensaje = repositorio.save(MensajeWhatsapp.builder()
                .branchId(branchId)
                .destino(destino.trim())
                .texto(texto)
                .motivo(motivo)
                .claveReemplazo(claveReemplazo)
                .proximoIntento(ahora)
                .venceEn(ahora.plusMinutes(motivo.minutosDeVida))
                .creadoEn(ahora)
                .build());

        UUID id = mensaje.getId();
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    CompletableFuture.runAsync(() -> intentar(id));
                }
            });
        } else {
            CompletableFuture.runAsync(() -> intentar(id));
        }
    }

    /** Reintenta lo pendiente. Cada 10 segundos. */
    @Scheduled(fixedDelay = 10_000, initialDelay = 15_000)
    public void procesarPendientes() {
        LocalDateTime ahora = LocalDateTime.now();
        int vencidos = repositorio.vencer(ahora);
        if (vencidos > 0) {
            log.warn("{} mensajes de WhatsApp vencieron sin poder enviarse", vencidos);
        }
        repositorio.liberarAtorados(ahora.minusMinutes(2));

        // Si una sucursal fallo en esta vuelta, sus demas mensajes tambien
        // fallarian: se dejan para la siguiente y se conserva el orden.
        Set<UUID> sucursalesCaidas = new HashSet<>();
        for (MensajeWhatsapp m : repositorio.findTop100ByEstadoAndProximoIntentoLessThanEqualOrderByCreadoEnAsc(
                Estado.PENDIENTE, ahora)) {
            if (sucursalesCaidas.contains(m.getBranchId())) continue;
            if (!intentar(m.getId())) {
                sucursalesCaidas.add(m.getBranchId());
            }
        }
    }

    /** Limpieza diaria de lo que ya no sirve. */
    @Scheduled(cron = "0 30 4 * * *")
    public void limpiar() {
        int borrados = repositorio.borrarViejos(LocalDateTime.now().minusDays(7));
        log.info("Cola de WhatsApp: {} mensajes viejos borrados", borrados);
    }

    /**
     * Un intento de envio. Devuelve false solo si WhatsApp fallo; si el mensaje
     * ya no estaba pendiente o le toca esperar su turno, devuelve true.
     */
    boolean intentar(UUID id) {
        MensajeWhatsapp m = repositorio.findById(id).orElse(null);
        if (m == null || m.getEstado() != Estado.PENDIENTE) return true;

        if (repositorio.hayAnteriorPendiente(m.getBranchId(), m.getDestino(), m.getCreadoEn(), m.getId())) {
            return true; // Sale cuando salga el anterior; si no, llegarian desordenados.
        }
        if (repositorio.reclamar(id) == 0) return true; // Otro hilo lo tomo.

        LocalDateTime ahora = LocalDateTime.now();
        try {
            whatsapp.sendMessage(m.getBranchId().toString(), m.getDestino(), m.getTexto());
            m.setEstado(Estado.ENVIADO);
            m.setEnviadoEn(ahora);
            m.setIntentos(m.getIntentos() + 1);
            m.setUltimoError(null);
            repositorio.save(m);
            return true;
        } catch (Exception e) {
            int intentos = m.getIntentos() + 1;
            int espera = ESPERAS_SEGUNDOS[Math.min(intentos - 1, ESPERAS_SEGUNDOS.length - 1)];
            LocalDateTime siguiente = ahora.plus(Duration.ofSeconds(espera));
            boolean vence = siguiente.isAfter(m.getVenceEn());

            m.setIntentos(intentos);
            m.setUltimoError(resumir(e));
            m.setProximoIntento(siguiente);
            m.setEstado(vence ? Estado.VENCIDO : Estado.PENDIENTE);
            repositorio.save(m);

            if (vence) {
                log.warn("Mensaje {} a {} vencido tras {} intentos: {}", m.getMotivo(), m.getDestino(), intentos, m.getUltimoError());
            } else if (intentos == 1) {
                log.warn("WhatsApp de la sucursal {} no respondio ({}); se reintenta en {} s",
                        m.getBranchId(), m.getUltimoError(), espera);
            }
            return false;
        }
    }

    /** Como va la cola de una sucursal, para avisarlo en el panel. */
    public Salud salud(UUID branchId) {
        LocalDateTime haceUnaHora = LocalDateTime.now().minusHours(1);
        long pendientes = repositorio.countByBranchIdAndEstado(branchId, Estado.PENDIENTE)
                + repositorio.countByBranchIdAndEstado(branchId, Estado.ENVIANDO);
        long vencidos = repositorio.countByBranchIdAndEstadoAndCreadoEnAfter(branchId, Estado.VENCIDO, haceUnaHora);
        String error = pendientes + vencidos == 0 ? null
                : repositorio.findFirstByBranchIdAndUltimoErrorIsNotNullAndCreadoEnAfterOrderByCreadoEnDesc(branchId, haceUnaHora)
                        .map(MensajeWhatsapp::getUltimoError).orElse(null);
        return new Salud(pendientes, vencidos, error);
    }

    /** Mensajes esperando, los que vencieron en la ultima hora y el ultimo error. */
    public record Salud(long pendientes, long vencidosUltimaHora, String ultimoError) {
    }

    /** El servicio de WhatsApp responde un JSON con "error"; basta con eso. */
    private static String resumir(Exception e) {
        String msg = e.getMessage() == null ? e.getClass().getSimpleName() : e.getMessage();
        int i = msg.indexOf("\"error\":\"");
        if (i >= 0) {
            int fin = msg.indexOf('"', i + 9);
            if (fin > i) msg = msg.substring(i + 9, fin);
        }
        return msg.length() > 290 ? msg.substring(0, 290) : msg;
    }
}
