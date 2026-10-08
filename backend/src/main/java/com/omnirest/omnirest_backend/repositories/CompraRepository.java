package com.omnirest.omnirest_backend.repositories;

import com.omnirest.omnirest_backend.domain.entities.Compra;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface CompraRepository extends JpaRepository<Compra, UUID> {
    List<Compra> findTop30ByBranchIdOrderByCreadoEnDesc(UUID branchId);

    /** Lo comprado a credito en la sucursal que falta pagar, lo que vence primero arriba. */
    List<Compra> findByBranchIdAndFormaPagoAndPagadaEnIsNullAndAnuladaEnIsNullOrderByVenceAscFechaAsc(UUID branchId, String formaPago);

    /** Lo que se le debe a cada proveedor: compras a credito sin pagar ni anular. [proveedorId, total] */
    @org.springframework.data.jpa.repository.Query("SELECT c.proveedorId, COALESCE(SUM(c.total), 0) FROM Compra c "
            + "WHERE c.proveedorId IN :ids AND c.formaPago = 'CREDITO' AND c.pagadaEn IS NULL AND c.anuladaEn IS NULL "
            + "GROUP BY c.proveedorId")
    List<Object[]> adeudos(@org.springframework.data.repository.query.Param("ids") java.util.Collection<UUID> ids);
}
