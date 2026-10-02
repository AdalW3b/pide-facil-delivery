package com.omnirest.omnirest_backend.services;

import com.omnirest.omnirest_backend.domain.entities.Branch;
import com.omnirest.omnirest_backend.domain.entities.Order;
import com.omnirest.omnirest_backend.domain.enums.DeliveryStatus;
import com.omnirest.omnirest_backend.domain.enums.OrderType;
import com.omnirest.omnirest_backend.dtos.CajaDTOs;
import com.omnirest.omnirest_backend.dtos.CambiarEstadoEntregaDTO;
import com.omnirest.omnirest_backend.repositories.OrderRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** Un solo "Cobrar" para mesas y mostrador; lo del kiosko entra a cocina al cobrarse. */
class MostradorServiceTest {

    private final UUID branchId = UUID.randomUUID();
    private final Branch sucursal = Branch.builder().id(branchId).build();
    private final CajaService cajaService = mock(CajaService.class);
    private final DeliveryService deliveryService = mock(DeliveryService.class);
    private final OrderRepository orderRepository = mock(OrderRepository.class);
    private final MostradorService servicio = new MostradorService(cajaService, deliveryService, orderRepository);
    private final List<CajaDTOs.PagoPeticion> pagos = List.of(
            new CajaDTOs.PagoPeticion(UUID.randomUUID(), new BigDecimal("50"), null, null));

    private Order order;

    @BeforeEach
    void setUp() {
        order = Order.builder().id(UUID.randomUUID()).branch(sucursal).orderType(OrderType.PARA_LLEVAR)
                .deliveryStatus(DeliveryStatus.NUEVO).origen("KIOSKO").turno("A-023").build();
        when(orderRepository.findById(order.getId())).thenReturn(Optional.of(order));
        when(cajaService.registrarPagos(any(), any(), any(), any())).thenReturn(List.of());
    }

    @Test
    @DisplayName("Kiosko: cobra y lo manda a cocina")
    void kiosko() {
        servicio.cobrar(branchId, order.getId(), pagos, null);

        verify(cajaService).registrarPagos(branchId, order.getId(), pagos, null);
        ArgumentCaptor<CambiarEstadoEntregaDTO> cambio = ArgumentCaptor.forClass(CambiarEstadoEntregaDTO.class);
        verify(deliveryService).cambiarEstado(eq(branchId), eq(order.getId()), cambio.capture());
        assertEquals(DeliveryStatus.CONFIRMADO, cambio.getValue().estado());
    }

    @Test
    @DisplayName("Para recoger ya aceptado: solo queda pagado, no cambia de estado")
    void recogerAceptado() {
        order.setOrigen("WEB");
        order.setDeliveryStatus(DeliveryStatus.LISTO);
        servicio.cobrar(branchId, order.getId(), pagos, null);

        verify(cajaService).registrarPagos(any(), any(), any(), any());
        verify(deliveryService, never()).cambiarEstado(any(), any(), any());
        verify(deliveryService).publicarTableroDe(branchId);
    }

    @Test
    @DisplayName("Una mesa se cobra como siempre (y se libera)")
    void mesa() {
        order.setOrderType(OrderType.SALON);
        servicio.cobrar(branchId, order.getId(), pagos, null);
        verify(cajaService).cobrar(branchId, order.getId(), pagos, null);
        verify(cajaService, never()).registrarPagos(any(), any(), any(), any());
    }

    @Test
    @DisplayName("Domicilio, Rappi y pedidos cerrados no se cobran en caja")
    void noAplica() {
        order.setOrderType(OrderType.DOMICILIO);
        assertThrows(IllegalStateException.class, () -> servicio.cobrar(branchId, order.getId(), pagos, null));

        order.setOrderType(OrderType.PARA_LLEVAR);
        order.setOrigen("RAPPI");
        assertThrows(IllegalStateException.class, () -> servicio.cobrar(branchId, order.getId(), pagos, null));

        order.setOrigen("KIOSKO");
        order.setDeliveryStatus(DeliveryStatus.CANCELADO);
        assertThrows(IllegalStateException.class, () -> servicio.cobrar(branchId, order.getId(), pagos, null));
        verify(cajaService, never()).registrarPagos(any(), any(), any(), any());
    }
}
