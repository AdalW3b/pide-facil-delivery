package com.omnirest.omnirest_backend.services;

import com.omnirest.omnirest_backend.domain.entities.Order;
import com.omnirest.omnirest_backend.domain.entities.OrderItem;
import com.omnirest.omnirest_backend.domain.enums.KitchenStatus;
import com.omnirest.omnirest_backend.dtos.EntregaHistorialDTO;
import com.omnirest.omnirest_backend.dtos.PedidoHistorialDTO;
import com.omnirest.omnirest_backend.repositories.OrderItemRepository;
import com.omnirest.omnirest_backend.repositories.OrderRepository;
import com.omnirest.omnirest_backend.security.CuentaPublicaPrincipal;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;

/**
 * Lo que un cliente o un repartidor puede ver de si mismo.
 *
 * Todo se filtra por el id que viene en su token, nunca por uno que mande la
 * peticion: de otro modo bastaria cambiar un numero en la URL para leer el
 * historial de cualquiera.
 */
@Service
@RequiredArgsConstructor
public class HistorialCuentaService {

    private final OrderRepository orderRepository;
    private final OrderItemRepository orderItemRepository;
    private final com.omnirest.omnirest_backend.repositories.CustomerAddressRepository direccionRepository;
    private final com.omnirest.omnirest_backend.repositories.BranchRepository branchRepository;

    @Transactional(readOnly = true)
    public List<PedidoHistorialDTO> pedidosDelCliente(CuentaPublicaPrincipal cuenta) {
        exigirCuenta(cuenta);
        return orderRepository.findByCustomerIdOrderByCreatedAtDesc(cuenta.cuentaId()).stream()
                .map(this::aPedido)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<EntregaHistorialDTO> entregasDelRepartidor(CuentaPublicaPrincipal cuenta) {
        exigirCuenta(cuenta);
        return orderRepository.findByDriverIdOrderByCreatedAtDesc(cuenta.cuentaId()).stream()
                .map(this::aEntrega)
                .toList();
    }

    /**
     * Las direcciones guardadas del cliente, para elegirlas en el menu en linea
     * en vez de volver a marcar el pin. Si abre el menu de otro restaurante,
     * sus direcciones de aqui no aplican: lista vacia.
     */
    @Transactional(readOnly = true)
    public List<com.omnirest.omnirest_backend.dtos.ClienteTelefonoDTO.Direccion> direccionesDelCliente(
            java.util.UUID branchId, CuentaPublicaPrincipal cuenta) {
        exigirCuenta(cuenta);
        if (!esDelRestaurante(branchId, cuenta)) return List.of();
        return direccionRepository.findByCustomerIdAndActivaTrueOrderByEsPrincipalDescCreadaEnDesc(cuenta.cuentaId())
                .stream()
                .map(a -> new com.omnirest.omnirest_backend.dtos.ClienteTelefonoDTO.Direccion(
                        a.getId(), a.getAlias(), a.getDireccion(), a.getReferencias(), a.getLatitud(), a.getLongitud()))
                .toList();
    }

    /** Quita una direccion guardada. Solo las suyas: se busca por su id de cuenta. */
    @Transactional
    public void borrarDireccion(CuentaPublicaPrincipal cuenta, java.util.UUID direccionId) {
        exigirCuenta(cuenta);
        var direccion = direccionRepository.findByIdAndCustomerId(direccionId, cuenta.cuentaId())
                .orElseThrow(() -> new IllegalArgumentException("Esa dirección ya no existe."));
        direccion.setActiva(false);
        direccionRepository.save(direccion);
    }

    private boolean esDelRestaurante(java.util.UUID branchId, CuentaPublicaPrincipal cuenta) {
        return branchRepository.findById(branchId)
                .map(b -> b.getRestaurant().getId().equals(cuenta.restaurantId()))
                .orElse(false);
    }

    private void exigirCuenta(CuentaPublicaPrincipal cuenta) {
        if (cuenta == null || cuenta.cuentaId() == null) {
            throw new AccessDeniedException("Inicia sesión para ver tu historial.");
        }
    }

    private PedidoHistorialDTO aPedido(Order order) {
        List<OrderItem> vivos = itemsVivos(order);

        BigDecimal comida = vivos.stream()
                .filter(i -> i.getUnitPrice() != null)
                .map(i -> i.getUnitPrice().multiply(BigDecimal.valueOf(i.getQuantity() != null ? i.getQuantity() : 1)))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal envio = order.getEnvioCobrado() != null ? order.getEnvioCobrado() : BigDecimal.ZERO;
        BigDecimal propina = order.getPropina() != null ? order.getPropina() : BigDecimal.ZERO;

        return new PedidoHistorialDTO(
                order.getId(),
                order.getTokenSeguimiento(),
                order.getOrderType(),
                order.getStatus(),
                order.getDeliveryStatus(),
                order.getCreatedAt(),
                order.getDireccionEntrega(),
                order.getTable() != null ? order.getTable().getTableNumber() : null,
                vivos.stream().map(this::describir).toList(),
                comida,
                envio,
                propina,
                comida.add(envio).add(propina));
    }

    private EntregaHistorialDTO aEntrega(Order order) {
        BigDecimal propina = order.getPropina() != null ? order.getPropina() : BigDecimal.ZERO;
        BigDecimal cobrado = (order.getTotalAmount() != null ? order.getTotalAmount() : BigDecimal.ZERO)
                .add(order.getEnvioCobrado() != null ? order.getEnvioCobrado() : BigDecimal.ZERO)
                .add(propina);

        return new EntregaHistorialDTO(
                order.getId(),
                order.getTokenSeguimiento(),
                order.getDeliveryStatus(),
                order.getBranch() != null ? order.getBranch().getName() : null,
                order.getDireccionEntrega(),
                order.getDistanciaKm(),
                order.getPagoRepartidor(),
                cobrado,
                propina,
                order.getAsignadoEn(),
                order.getEntregadoEn());
    }

    /** Los platillos cancelados no se cobraron: tampoco se listan. */
    private List<OrderItem> itemsVivos(Order order) {
        return orderItemRepository.findByOrderId(order.getId()).stream()
                .filter(i -> i.getKitchenStatus() != KitchenStatus.CANCELLED)
                .toList();
    }

    private String describir(OrderItem item) {
        String nombre = item.getProduct() != null ? item.getProduct().getName() : "Producto";
        int cantidad = item.getQuantity() != null ? item.getQuantity() : 1;
        List<String> adicionales = item.adicionalesParaMostrar();
        return adicionales.isEmpty()
                ? cantidad + "x " + nombre
                : cantidad + "x " + nombre + " (" + String.join(" · ", adicionales) + ")";
    }
}
