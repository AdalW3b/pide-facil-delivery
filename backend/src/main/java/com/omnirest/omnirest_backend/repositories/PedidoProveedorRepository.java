package com.omnirest.omnirest_backend.repositories;

import com.omnirest.omnirest_backend.domain.entities.PedidoProveedor;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface PedidoProveedorRepository extends JpaRepository<PedidoProveedor, UUID> {
    List<PedidoProveedor> findTop40ByBranchIdOrderByCreadoEnDesc(UUID branchId);
}
