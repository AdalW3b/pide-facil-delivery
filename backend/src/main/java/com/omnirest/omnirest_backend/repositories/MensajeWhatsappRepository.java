package com.omnirest.omnirest_backend.repositories;

import com.omnirest.omnirest_backend.domain.entities.MensajeWhatsapp;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/*
 * Todas las fechas las pone Java, tambien al comparar: asi la cola no depende
 * de que la zona horaria de la base coincida con la del servidor.
 */
@Repository
public interface MensajeWhatsappRepository extends JpaRepository<MensajeWhatsapp, UUID> {

    /** Los que ya toca intentar, del mas viejo al mas nuevo. */
    List<MensajeWhatsapp> findTop100ByEstadoAndProximoIntentoLessThanEqualOrderByCreadoEnAsc(
            MensajeWhatsapp.Estado estado, LocalDateTime ahora);

    /**
     * Toma el mensaje para enviarlo. Devuelve 0 si otro hilo se lo gano: asi el
     * intento inmediato y el reintento programado nunca mandan el mismo dos veces.
     */
    @Modifying
    @Transactional
    @Query("UPDATE MensajeWhatsapp m SET m.estado = 'ENVIANDO' WHERE m.id = :id AND m.estado = 'PENDIENTE'")
    int reclamar(@Param("id") UUID id);

    /** Un mensaje nuevo con la misma clave deja sin sentido a los pendientes anteriores. */
    @Modifying
    @Transactional
    @Query("UPDATE MensajeWhatsapp m SET m.estado = 'REEMPLAZADO' "
            + "WHERE m.claveReemplazo = :clave AND m.estado = 'PENDIENTE'")
    int reemplazar(@Param("clave") String clave);

    @Modifying
    @Transactional
    @Query("UPDATE MensajeWhatsapp m SET m.estado = 'VENCIDO' "
            + "WHERE m.estado = 'PENDIENTE' AND m.venceEn < :ahora")
    int vencer(@Param("ahora") LocalDateTime ahora);

    /** Si el servidor se cayo a media entrega, el mensaje vuelve a la cola. */
    @Modifying
    @Transactional
    @Query("UPDATE MensajeWhatsapp m SET m.estado = 'PENDIENTE' "
            + "WHERE m.estado = 'ENVIANDO' AND m.proximoIntento < :antesDe")
    int liberarAtorados(@Param("antesDe") LocalDateTime antesDe);

    /** Hay un mensaje anterior al mismo destino que todavia no sale: el orden importa. */
    @Query("SELECT COUNT(m) > 0 FROM MensajeWhatsapp m WHERE m.branchId = :branchId AND m.destino = :destino "
            + "AND m.estado IN ('PENDIENTE', 'ENVIANDO') AND m.creadoEn < :creadoEn AND m.id <> :id")
    boolean hayAnteriorPendiente(@Param("branchId") UUID branchId, @Param("destino") String destino,
                                 @Param("creadoEn") LocalDateTime creadoEn, @Param("id") UUID id);

    long countByBranchIdAndEstado(UUID branchId, MensajeWhatsapp.Estado estado);

    long countByBranchIdAndEstadoAndCreadoEnAfter(UUID branchId, MensajeWhatsapp.Estado estado, LocalDateTime desde);

    Optional<MensajeWhatsapp> findFirstByBranchIdAndUltimoErrorIsNotNullAndCreadoEnAfterOrderByCreadoEnDesc(
            UUID branchId, LocalDateTime desde);

    /** Limpieza: lo enviado o descartado de hace dias ya no le sirve a nadie. */
    @Modifying
    @Transactional
    @Query("DELETE FROM MensajeWhatsapp m WHERE m.estado IN ('ENVIADO', 'VENCIDO', 'REEMPLAZADO') "
            + "AND m.creadoEn < :antesDe")
    int borrarViejos(@Param("antesDe") LocalDateTime antesDe);
}
