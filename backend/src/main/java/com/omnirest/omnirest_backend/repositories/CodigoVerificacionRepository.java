package com.omnirest.omnirest_backend.repositories;

import com.omnirest.omnirest_backend.domain.entities.CodigoVerificacion;
import com.omnirest.omnirest_backend.domain.enums.TipoCuenta;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface CodigoVerificacionRepository extends JpaRepository<CodigoVerificacion, UUID> {

    /** El ultimo codigo pedido para ese telefono, sea o no vigente. */
    Optional<CodigoVerificacion> findFirstByRestaurantIdAndTipoAndPhoneNumberOrderByCreadoEnDesc(
            UUID restaurantId, TipoCuenta tipo, String phoneNumber);

    /*
     * Los conteos usan el reloj de la base, no el de Java: creado_en lo llena
     * now() de Postgres, y si las dos zonas horarias no coinciden la ventana
     * quedaria corrida horas.
     */

    /** Cuantos codigos se han pedido para un telefono en los ultimos N segundos, de cualquier tipo. */
    @Query(value = "SELECT count(*) FROM codigos_verificacion "
            + "WHERE restaurant_id = :restaurantId AND phone_number = :phoneNumber "
            + "AND creado_en > now() - make_interval(secs => :segundos)", nativeQuery = true)
    long contarRecientesDelTelefono(@Param("restaurantId") UUID restaurantId,
                                    @Param("phoneNumber") String phoneNumber,
                                    @Param("segundos") int segundos);

    /** Cuantos codigos ha mandado un restaurante en los ultimos N segundos, a cualquier numero. */
    @Query(value = "SELECT count(*) FROM codigos_verificacion "
            + "WHERE restaurant_id = :restaurantId "
            + "AND creado_en > now() - make_interval(secs => :segundos)", nativeQuery = true)
    long contarRecientesDelRestaurante(@Param("restaurantId") UUID restaurantId,
                                       @Param("segundos") int segundos);

    /**
     * Invalida los codigos anteriores al mandar uno nuevo: si quedaran vivos,
     * un codigo viejo interceptado seguiria sirviendo.
     */
    @Modifying
    @Query("UPDATE CodigoVerificacion c SET c.usadoEn = :ahora "
            + "WHERE c.restaurantId = :restaurantId AND c.tipo = :tipo "
            + "AND c.phoneNumber = :phoneNumber AND c.usadoEn IS NULL")
    void invalidarAnteriores(@Param("restaurantId") UUID restaurantId,
                             @Param("tipo") TipoCuenta tipo,
                             @Param("phoneNumber") String phoneNumber,
                             @Param("ahora") LocalDateTime ahora);
}
