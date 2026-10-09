package com.omnirest.omnirest_backend.repositories;

import com.omnirest.omnirest_backend.domain.entities.EventoStripe;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

/* Las fechas las pone Java, como en la cola de WhatsApp. */
@Repository
public interface EventoStripeRepository extends JpaRepository<EventoStripe, String> {

    /**
     * Guarda el evento si es nuevo. Devuelve 0 si Stripe ya lo habia mandado:
     * asi dos entregas del mismo evento, aun al mismo tiempo, se guardan una vez.
     */
    @Modifying
    @Transactional
    @Query(value = "INSERT INTO eventos_stripe (id, tipo, cuenta, livemode, payload, estado, intentos, proximo_intento, recibido_en) "
            + "VALUES (:id, :tipo, :cuenta, :livemode, :payload, 'PENDIENTE', 0, :ahora, :ahora) "
            + "ON CONFLICT (id) DO NOTHING", nativeQuery = true)
    int guardarSiNuevo(@Param("id") String id, @Param("tipo") String tipo, @Param("cuenta") String cuenta,
                       @Param("livemode") boolean livemode, @Param("payload") String payload,
                       @Param("ahora") LocalDateTime ahora);

    /** Los que ya toca procesar, del mas viejo al mas nuevo. */
    List<EventoStripe> findTop50ByEstadoAndProximoIntentoLessThanEqualOrderByRecibidoEnAsc(
            EventoStripe.Estado estado, LocalDateTime ahora);

    /** Toma el evento. Devuelve 0 si otro hilo se lo gano. */
    @Modifying
    @Transactional
    @Query("UPDATE EventoStripe e SET e.estado = 'PROCESANDO', e.proximoIntento = :ahora "
            + "WHERE e.id = :id AND e.estado = 'PENDIENTE'")
    int reclamar(@Param("id") String id, @Param("ahora") LocalDateTime ahora);

    /** Si el servidor se cayo a medio procesar, el evento vuelve a la cola. */
    @Modifying
    @Transactional
    @Query("UPDATE EventoStripe e SET e.estado = 'PENDIENTE' "
            + "WHERE e.estado = 'PROCESANDO' AND e.proximoIntento < :antesDe")
    int liberarAtorados(@Param("antesDe") LocalDateTime antesDe);

    @Modifying
    @Transactional
    @Query("UPDATE EventoStripe e SET e.estado = :estado, e.procesadoEn = :ahora, e.error = null WHERE e.id = :id")
    int terminar(@Param("id") String id, @Param("estado") EventoStripe.Estado estado, @Param("ahora") LocalDateTime ahora);

    @Modifying
    @Transactional
    @Query("UPDATE EventoStripe e SET e.estado = :estado, e.intentos = e.intentos + 1, "
            + "e.proximoIntento = :proximo, e.error = :error WHERE e.id = :id")
    int fallo(@Param("id") String id, @Param("estado") EventoStripe.Estado estado,
              @Param("proximo") LocalDateTime proximo, @Param("error") String error);

    /** Limpieza: lo procesado hace mucho ya no sirve. */
    @Modifying
    @Transactional
    @Query("DELETE FROM EventoStripe e WHERE e.estado IN ('PROCESADO', 'IGNORADO') AND e.recibidoEn < :antesDe")
    int borrarViejos(@Param("antesDe") LocalDateTime antesDe);
}
