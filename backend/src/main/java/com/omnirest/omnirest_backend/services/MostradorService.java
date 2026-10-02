package com.omnirest.omnirest_backend.services;

import com.omnirest.omnirest_backend.domain.entities.Order;
import com.omnirest.omnirest_backend.domain.entities.Pago;
import com.omnirest.omnirest_backend.domain.enums.DeliveryStatus;
import com.omnirest.omnirest_backend.domain.enums.OrderType;
import com.omnirest.omnirest_backend.dtos.CajaDTOs;
import com.omnirest.omnirest_backend.dtos.CambiarEstadoEntregaDTO;
import com.omnirest.omnirest_backend.repositories.OrderRepository;
import com.omnirest.omnirest_backend.security.CustomUserDetails;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

/**
 * Cobrar en caja, venga de donde venga la cuenta.
 *
 * Una mesa se cobra y se libera. Un pedido de mostrador se cobra y, si es del
 * kiosko y estaba esperando el pago, entra a cocina en ese momento: lo del
 * kiosko no se prepara sin pagarse. Vive aparte de la caja porque necesita al
 * tablero de domicilio, y el tablero ya depende de la caja.
 */
@Service
@RequiredArgsConstructor
public class MostradorService {

    private final CajaService cajaService;
    private final DeliveryService deliveryService;
    private final OrderRepository orderRepository;

    @Transactional
    public CajaDTOs.CobroResultado cobrar(UUID branchId, UUID orderId, List<CajaDTOs.PagoPeticion> pagos,
                                          CustomUserDetails user) {
        Order order = orderRepository.findById(orderId)
                .filter(o -> o.getBranch() != null && branchId.equals(o.getBranch().getId()))
                .orElseThrow(() -> new IllegalArgumentException("Cuenta no encontrada en esta sucursal."));

        if (order.getOrderType() == null || order.getOrderType() == OrderType.SALON) {
            return cajaService.cobrar(branchId, orderId, pagos, user);
        }
        if (order.getOrderType() != OrderType.PARA_LLEVAR || "RAPPI".equals(order.getOrigen())) {
            throw new IllegalStateException("Este pedido no se cobra en caja: se cobra al entregarse.");
        }
        if (order.getDeliveryStatus() != null && order.getDeliveryStatus().esFinal()) {
            throw new IllegalStateException("Este pedido ya está cerrado.");
        }

        List<Pago> registrados = cajaService.registrarPagos(branchId, orderId, pagos, user);

        // Del kiosko: pagado, ahora si a cocina (y ahi se descuenta el inventario).
        if (order.getDeliveryStatus() == DeliveryStatus.NUEVO && "KIOSKO".equals(order.getOrigen())) {
            deliveryService.cambiarEstado(branchId, orderId, new CambiarEstadoEntregaDTO(DeliveryStatus.CONFIRMADO, null));
        } else {
            deliveryService.publicarTableroDe(branchId);
        }
        return cajaService.resultado(orderId, registrados);
    }
}
