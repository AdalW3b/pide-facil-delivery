package com.omnirest.omnirest_backend.repositories;

import com.omnirest.omnirest_backend.domain.entities.AccionSoporte;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

@Repository
public interface AccionSoporteRepository extends JpaRepository<AccionSoporte, UUID> {
    List<AccionSoporte> findBySesionIdInOrderByEnAsc(Collection<UUID> sesionIds);
}
