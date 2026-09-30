package com.omnirest.omnirest_backend.repositories;

import com.omnirest.omnirest_backend.domain.entities.Order;
import com.omnirest.omnirest_backend.domain.enums.OrderStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface OrderRepository extends JpaRepository<Order, UUID> {
    List<Order> findByBranchId(UUID branchId);
    List<Order> findByBranchIdAndStatus(UUID branchId, OrderStatus status);
    List<Order> findByBranchIdAndStatusInOrderByCreatedAtDesc(UUID branchId, List<OrderStatus> statuses);
    Optional<Order> findByIdAndBranchId(UUID id, UUID branchId);

    /** El token es la llave publica del pedido: la usan cliente y repartidor. */
    Optional<Order> findByTokenSeguimiento(String tokenSeguimiento);

    /** El historial que ve el cliente en su cuenta. */
    List<Order> findByCustomerIdOrderByCreatedAtDesc(UUID customerId);

    /** El historial que ve el repartidor en su cuenta. */
    List<Order> findByDriverIdOrderByCreatedAtDesc(UUID driverId);

    Optional<Order> findByBranchIdAndTableTableNumberAndStatus(UUID branchId, Integer tableNumber, OrderStatus status);
    Optional<Order> findByBranchIdAndCustomerPhoneNumberAndStatus(UUID branchId, String phoneNumber, OrderStatus status);

    /**
     * La cuenta abierta de un cliente en una mesa (no sus pedidos a domicilio
     * o para llevar). La mas reciente, por si hubiera mas de una.
     */
    Optional<Order> findFirstByBranchIdAndCustomerPhoneNumberAndStatusAndOrderTypeOrderByCreatedAtDesc(
            UUID branchId, String phoneNumber, OrderStatus status, com.omnirest.omnirest_backend.domain.enums.OrderType orderType);

    // Optimización para el KDS (Cocina) - Trae órdenes activas y todo su detalle.
    // Un pedido a domicilio entra a cocina solo despues de que la sucursal lo
    // acepta: mientras esta en NUEVO nadie se pone a cocinarlo, y si se rechaza
    // desaparece del tablero.
    @Query("SELECT DISTINCT o FROM Order o " +
           "LEFT JOIN FETCH o.table " +
           "LEFT JOIN FETCH o.orderItems oi " +
           "LEFT JOIN FETCH oi.product " +
           "WHERE o.branch.id = :branchId AND o.status NOT IN ('CLOSED', 'CANCELLED') " +
           "AND (o.orderType = com.omnirest.omnirest_backend.domain.enums.OrderType.SALON " +
           "     OR o.deliveryStatus IS NULL " +
           "     OR o.deliveryStatus NOT IN (" +
           "         com.omnirest.omnirest_backend.domain.enums.DeliveryStatus.NUEVO, " +
           "         com.omnirest.omnirest_backend.domain.enums.DeliveryStatus.CANCELADO))")
    List<Order> findActiveOrdersWithDetailsByBranch(@Param("branchId") UUID branchId);

    /** Pedidos que no son de salon, para el tablero de reparto. */
    @Query("SELECT DISTINCT o FROM Order o " +
           "LEFT JOIN FETCH o.orderItems oi " +
           "LEFT JOIN FETCH oi.product " +
           "LEFT JOIN FETCH o.customer " +
           "WHERE o.branch.id = :branchId " +
           "AND o.orderType <> com.omnirest.omnirest_backend.domain.enums.OrderType.SALON " +
           "AND (:soloActivos = false OR o.deliveryStatus NOT IN (" +
           "     com.omnirest.omnirest_backend.domain.enums.DeliveryStatus.ENTREGADO, " +
           "     com.omnirest.omnirest_backend.domain.enums.DeliveryStatus.CANCELADO)) " +
           "ORDER BY o.createdAt ASC")
    List<Order> findDeliveryOrders(@Param("branchId") UUID branchId,
                                   @Param("soloActivos") boolean soloActivos);

    /**
     * Igual que el anterior, acotado a partir de una fecha. Va aparte en vez de
     * recibir un parametro opcional: Postgres no puede deducir el tipo de una
     * fecha nula suelta en el WHERE y la consulta falla al ejecutarse.
     */
    @Query("SELECT DISTINCT o FROM Order o " +
           "LEFT JOIN FETCH o.orderItems oi " +
           "LEFT JOIN FETCH oi.product " +
           "LEFT JOIN FETCH o.customer " +
           "WHERE o.branch.id = :branchId " +
           "AND o.orderType <> com.omnirest.omnirest_backend.domain.enums.OrderType.SALON " +
           "AND o.createdAt >= :desde " +
           "AND (:soloActivos = false OR o.deliveryStatus NOT IN (" +
           "     com.omnirest.omnirest_backend.domain.enums.DeliveryStatus.ENTREGADO, " +
           "     com.omnirest.omnirest_backend.domain.enums.DeliveryStatus.CANCELADO)) " +
           "ORDER BY o.createdAt ASC")
    List<Order> findDeliveryOrdersDesde(@Param("branchId") UUID branchId,
                                        @Param("soloActivos") boolean soloActivos,
                                        @Param("desde") java.time.LocalDateTime desde);

    /** Por repartidor, las entregas cerradas que todavia no pasan por caja. */
    @Query("SELECT new com.omnirest.omnirest_backend.dtos.CuadreDTOs$Pendiente(" +
           "  d.id, d.nombre, d.phoneNumber, count(o), " +
           "  coalesce(sum(o.totalAmount + coalesce(o.envioCobrado, 0)), 0), " +
           "  coalesce(sum(o.pagoRepartidor), 0), coalesce(sum(o.propina), 0), min(o.entregadoEn), max(o.entregadoEn)) " +
           "FROM Order o JOIN o.driver d " +
           "WHERE o.branch.id = :branchId AND o.corteId IS NULL " +
           "AND o.deliveryStatus = com.omnirest.omnirest_backend.domain.enums.DeliveryStatus.ENTREGADO " +
           "GROUP BY d.id, d.nombre, d.phoneNumber ORDER BY d.nombre")
    List<com.omnirest.omnirest_backend.dtos.CuadreDTOs.Pendiente> pendientesDeCuadre(@Param("branchId") UUID branchId);

    /**
     * Marca como liquidadas las entregas pendientes de un repartidor. Es un solo
     * UPDATE para que dos cierres simultaneos no se lleven las mismas entregas.
     */
    @org.springframework.data.jpa.repository.Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("UPDATE Order o SET o.corteId = :corteId WHERE o.branch.id = :branchId AND o.driver.id = :driverId " +
           "AND o.corteId IS NULL " +
           "AND o.deliveryStatus = com.omnirest.omnirest_backend.domain.enums.DeliveryStatus.ENTREGADO")
    int liquidar(@Param("branchId") UUID branchId, @Param("driverId") UUID driverId, @Param("corteId") UUID corteId);

    /** Totales de lo que quedo en un corte: [entregas, cobrado, pago]. */
    @Query("SELECT count(o), coalesce(sum(o.totalAmount + coalesce(o.envioCobrado, 0)), 0), " +
           "coalesce(sum(o.pagoRepartidor), 0) FROM Order o WHERE o.corteId = :corteId")
    List<Object[]> totalesDelCorte(@Param("corteId") UUID corteId);

    /**
     * Resumen por repartidor de las entregas cerradas en un periodo. Solo
     * cuenta las ENTREGADO: lo cancelado o en ruta no se paga todavia.
     */
    @Query("SELECT new com.omnirest.omnirest_backend.dtos.ReporteRepartidorDTO(" +
           "  d.id, d.nombre, d.phoneNumber, d.vehiculo, d.activo, " +
           "  count(o), " +
           "  coalesce(sum(o.distanciaKm), 0), " +
           "  coalesce(sum(o.pagoRepartidor), 0), " +
           "  coalesce(sum(o.totalAmount + coalesce(o.envioCobrado, 0)), 0), " +
           "  coalesce(sum(o.propina), 0), " +
           "  max(o.entregadoEn)) " +
           "FROM Order o JOIN o.driver d " +
           "WHERE o.branch.id = :branchId " +
           "AND o.deliveryStatus = com.omnirest.omnirest_backend.domain.enums.DeliveryStatus.ENTREGADO " +
           "AND o.entregadoEn >= :desde AND o.entregadoEn < :hasta " +
           "GROUP BY d.id, d.nombre, d.phoneNumber, d.vehiculo, d.activo " +
           "ORDER BY count(o) DESC")
    List<com.omnirest.omnirest_backend.dtos.ReporteRepartidorDTO> reportePorRepartidor(
            @Param("branchId") UUID branchId,
            @Param("desde") java.time.LocalDateTime desde,
            @Param("hasta") java.time.LocalDateTime hasta);

    // Optimización para el Historial con Paginación
    @Query(value = "SELECT DISTINCT o FROM Order o " +
           "LEFT JOIN FETCH o.table " +
           "LEFT JOIN FETCH o.orderItems oi " +
           "LEFT JOIN FETCH oi.product " +
           "WHERE o.branch.id = :branchId",
           countQuery = "SELECT count(o) FROM Order o WHERE o.branch.id = :branchId")
    Page<Order> findAllOrdersWithDetailsByBranch(@Param("branchId") UUID branchId, Pageable pageable);
}
