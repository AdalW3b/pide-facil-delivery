package com.omnirest.omnirest_backend.repositories;

import com.omnirest.omnirest_backend.domain.entities.TransaccionLinea;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface TransaccionLineaRepository extends JpaRepository<TransaccionLinea, UUID> {

    Optional<TransaccionLinea> findByPaymentIntentId(String paymentIntentId);

    /**
     * La transaccion bloqueada hasta terminar: el aviso de Stripe, la consulta
     * del cliente y el vencimiento pueden llegar a la vez y se forman en fila.
     */
    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @org.springframework.data.jpa.repository.Query("SELECT t FROM TransaccionLinea t WHERE t.id = :id")
    Optional<TransaccionLinea> bloquear(@org.springframework.data.repository.query.Param("id") UUID id);

    List<TransaccionLinea> findByOrderIdOrderByCreadoEnDesc(UUID orderId);

    /** Los cobros de un restaurante en un periodo, del mas nuevo al mas viejo. */
    @org.springframework.data.jpa.repository.Query("SELECT t FROM TransaccionLinea t WHERE t.restaurantId = :restaurantId "
            + "AND t.creadoEn >= :desde AND t.creadoEn < :hasta "
            + "AND t.estado IN :estados ORDER BY t.creadoEn DESC")
    List<TransaccionLinea> buscar(@org.springframework.data.repository.query.Param("restaurantId") UUID restaurantId,
                                  @org.springframework.data.repository.query.Param("desde") java.time.LocalDateTime desde,
                                  @org.springframework.data.repository.query.Param("hasta") java.time.LocalDateTime hasta,
                                  @org.springframework.data.repository.query.Param("estados") java.util.Collection<TransaccionLinea.Estado> estados,
                                  org.springframework.data.domain.Pageable pagina);

    /** Los abiertos que nadie ha revisado desde {@code antes}: se le pregunta a Stripe. */
    List<TransaccionLinea> findTop50ByEstadoInAndActualizadoEnBeforeOrderByActualizadoEnAsc(
            java.util.Collection<TransaccionLinea.Estado> estados, java.time.LocalDateTime antes);

    /** Los que siguen abiertos y ya pasaron su hora: se cancelan. */
    List<TransaccionLinea> findTop50ByEstadoInAndExpiraEnBeforeOrderByExpiraEnAsc(
            java.util.Collection<TransaccionLinea.Estado> estados, java.time.LocalDateTime ahora);
}
