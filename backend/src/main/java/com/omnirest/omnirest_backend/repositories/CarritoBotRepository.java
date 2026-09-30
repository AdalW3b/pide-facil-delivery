package com.omnirest.omnirest_backend.repositories;

import com.omnirest.omnirest_backend.domain.entities.CarritoBot;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.Optional;
import java.util.UUID;

public interface CarritoBotRepository extends JpaRepository<CarritoBot, UUID> {

    Optional<CarritoBot> findByBranchIdAndTelefono(UUID branchId, String telefono);

    /** Carritos que nadie toco desde hace tiempo: la conversacion ya termino. */
    @Modifying
    @Query("DELETE FROM CarritoBot c WHERE c.actualizadoEn < :limite")
    int borrarAbandonados(@Param("limite") LocalDateTime limite);
}
