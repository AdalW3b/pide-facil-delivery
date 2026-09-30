package com.omnirest.omnirest_backend.repositories;

import com.omnirest.omnirest_backend.domain.entities.ProductoAgotado;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Repository
public interface ProductoAgotadoRepository extends JpaRepository<ProductoAgotado, ProductoAgotado.Clave> {
    /** Los que se marcaron hoy: un "se acabo" de ayer ya no cuenta. */
    List<ProductoAgotado> findByBranchIdAndDesdeGreaterThanEqual(UUID branchId, LocalDateTime inicioDelDia);
}
