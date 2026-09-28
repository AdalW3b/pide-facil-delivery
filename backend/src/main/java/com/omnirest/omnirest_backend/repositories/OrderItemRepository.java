package com.omnirest.omnirest_backend.repositories;

import com.omnirest.omnirest_backend.domain.entities.OrderItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface OrderItemRepository extends JpaRepository<OrderItem, UUID> {
    List<OrderItem> findByOrderId(UUID orderId);

    /**
     * Los platillos que mas se pidieron en la sucursal desde cierta fecha, sin
     * contar lo cancelado. Solo ids: el menu ya trae el resto de los datos.
     */
    @org.springframework.data.jpa.repository.Query(value =
            "SELECT oi.product_id FROM order_items oi JOIN orders o ON o.id = oi.order_id "
            + "JOIN products p ON p.id = oi.product_id "
            + "WHERE o.branch_id = :branchId AND o.created_at >= :desde "
            + "AND o.status <> 'CANCELLED' AND oi.kitchen_status <> 'CANCELLED' AND p.active = true "
            + "GROUP BY oi.product_id ORDER BY SUM(oi.quantity) DESC LIMIT :limite", nativeQuery = true)
    List<UUID> masPedidos(@org.springframework.data.repository.query.Param("branchId") UUID branchId,
                          @org.springframework.data.repository.query.Param("desde") java.time.LocalDateTime desde,
                          @org.springframework.data.repository.query.Param("limite") int limite);
    List<OrderItem> findByOrderBranchId(UUID branchId);
    Optional<OrderItem> findByIdAndOrderBranchId(UUID id, UUID branchId);
}
