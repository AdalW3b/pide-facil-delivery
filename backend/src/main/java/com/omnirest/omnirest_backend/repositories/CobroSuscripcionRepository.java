package com.omnirest.omnirest_backend.repositories;

import com.omnirest.omnirest_backend.domain.entities.CobroSuscripcion;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface CobroSuscripcionRepository extends JpaRepository<CobroSuscripcion, UUID> {
    List<CobroSuscripcion> findByRestaurantIdOrderByCreadoEnDesc(UUID restaurantId);

    List<CobroSuscripcion> findTop200ByOrderByCreadoEnDesc();

    boolean existsByMetodoAndReferenciaAndEstado(CobroSuscripcion.Metodo metodo, String referencia,
                                                 CobroSuscripcion.Estado estado);
}
