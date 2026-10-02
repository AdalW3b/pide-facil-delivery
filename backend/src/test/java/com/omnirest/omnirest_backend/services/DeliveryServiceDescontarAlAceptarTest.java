package com.omnirest.omnirest_backend.services;

import com.omnirest.omnirest_backend.domain.entities.*;
import com.omnirest.omnirest_backend.domain.enums.DeliveryStatus;
import com.omnirest.omnirest_backend.domain.enums.KitchenStatus;
import com.omnirest.omnirest_backend.domain.enums.OrderStatus;
import com.omnirest.omnirest_backend.domain.enums.OrderType;
import com.omnirest.omnirest_backend.dtos.CambiarEstadoEntregaDTO;
import com.omnirest.omnirest_backend.repositories.BranchDeliverySettingsRepository;
import com.omnirest.omnirest_backend.repositories.OrderItemRepository;
import com.omnirest.omnirest_backend.repositories.OrderRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Pedidos de plataforma (Rappi): llegan sin descontar inventario, se descuenta
 * al aceptarlos y, si se cancelan antes, no hay nada que devolver.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class DeliveryServiceDescontarAlAceptarTest {

    @Mock OrderRepository orderRepository;
    @Mock OrderItemRepository orderItemRepository;
    @Mock BranchDeliverySettingsRepository deliverySettingsRepository;
    @Mock InventoryService inventoryService;
    @Mock ColaWhatsapp colaWhatsapp;
    @Mock org.springframework.messaging.simp.SimpMessagingTemplate messagingTemplate;
    @Mock OrderService orderService;
    @Mock com.omnirest.omnirest_backend.repositories.BranchRepository branchRepository;
    @Mock com.omnirest.omnirest_backend.repositories.CustomerRepository customerRepository;
    @Mock com.omnirest.omnirest_backend.repositories.CustomerAddressRepository customerAddressRepository;
    @Mock com.omnirest.omnirest_backend.repositories.ProductRepository productRepository;
    @Mock AdicionalesService adicionalesService;
    @Mock FotosService fotosService;
    @Mock PlanLimitService planLimitService;
    @Mock WhatsappIntegrationService whatsappIntegrationService;
    @Mock AgotadosService agotadosService;
    @InjectMocks DeliveryService servicio;

    private final UUID branchId = UUID.randomUUID();
    private final Branch sucursal = Branch.builder().id(branchId).build();
    private final Product pastor = Product.builder().id(UUID.randomUUID()).name("Taco de pastor")
            .price(new BigDecimal("25")).build();
    private Order pedido;
    private OrderItem linea;

    @BeforeEach
    void setUp() {
        pedido = Order.builder().id(UUID.randomUUID()).branch(sucursal)
                .status(OrderStatus.OPEN).orderType(OrderType.DOMICILIO)
                .deliveryStatus(DeliveryStatus.NUEVO)
                .origen("RAPPI").descontarAlAceptar(true).repartoExterno(true)
                .totalAmount(new BigDecimal("50")).build();
        linea = OrderItem.builder().id(UUID.randomUUID()).order(pedido).product(pastor).quantity(2)
                .unitPrice(new BigDecimal("25")).kitchenStatus(KitchenStatus.PENDING).build();
        when(orderRepository.findByIdAndBranchId(pedido.getId(), branchId)).thenReturn(Optional.of(pedido));
        when(orderItemRepository.findByOrderId(pedido.getId())).thenReturn(List.of(linea));
        when(branchRepository.findById(branchId)).thenReturn(Optional.of(sucursal));
        when(deliverySettingsRepository.findById(branchId)).thenReturn(Optional.of(
                BranchDeliverySettings.builder().grupoRepartidores("grupo@g.us").build()));
    }

    private void pasarA(DeliveryStatus estado) {
        servicio.cambiarEstado(branchId, pedido.getId(), new CambiarEstadoEntregaDTO(estado, null));
    }

    @Test
    @DisplayName("Al aceptarlo se descuenta el inventario una sola vez")
    void descuentaAlAceptar() {
        pasarA(DeliveryStatus.CONFIRMADO);

        verify(inventoryService).venderLinea(linea, branchId);
        verify(inventoryService).descontarAdicionales(linea, branchId);
        assertFalse(pedido.getDescontarAlAceptar());
        assertEquals(DeliveryStatus.CONFIRMADO, pedido.getDeliveryStatus());

        // Cancelarlo ya aceptado devuelve lo que se desconto.
        pasarA(DeliveryStatus.CANCELADO);
        verify(inventoryService, times(1)).venderLinea(any(), any());
        verify(inventoryService).devolverLinea(eq(linea), eq(branchId), anyBoolean(), any());
    }

    @Test
    @DisplayName("Si algo se acabo, no se acepta y sigue en NUEVO para rechazarlo")
    void agotadoFrenaLaAceptacion() {
        doThrow(new IllegalStateException("Taco de pastor se acabó por hoy."))
                .when(inventoryService).venderLinea(linea, branchId);

        IllegalStateException e = assertThrows(IllegalStateException.class, () -> pasarA(DeliveryStatus.CONFIRMADO));
        assertTrue(e.getMessage().contains("se acabó"));
        assertEquals(DeliveryStatus.NUEVO, pedido.getDeliveryStatus());
        assertTrue(pedido.getDescontarAlAceptar());
    }

    @Test
    @DisplayName("Rechazado antes de aceptar: no se devuelve nada al inventario")
    void rechazoSinDevolucion() {
        pasarA(DeliveryStatus.CANCELADO);

        verify(inventoryService, never()).venderLinea(any(), any());
        verify(inventoryService, never()).devolverLinea(any(), any(), anyBoolean(), any());
        verify(inventoryService, never()).devolverAdicionales(any(), any(), anyBoolean(), any());
        assertEquals(KitchenStatus.CANCELLED, linea.getKitchenStatus());
        assertEquals(OrderStatus.CANCELLED, pedido.getStatus());
    }

    @Test
    @DisplayName("Con repartidor de la plataforma, empacarlo no lo ofrece al grupo")
    void noSeOfreceAlGrupo() {
        pasarA(DeliveryStatus.CONFIRMADO);
        linea.setKitchenStatus(KitchenStatus.READY);
        pasarA(DeliveryStatus.LISTO);

        verify(colaWhatsapp, never()).encolar(any(), any(), any(), any(), any());
        assertThrows(IllegalStateException.class, () -> servicio.publicarAhora(branchId, pedido.getId()));
    }

    @Test
    @DisplayName("Los pedidos propios siguen descontando al crearse, no al aceptar")
    void pedidosPropiosSinCambios() {
        pedido.setDescontarAlAceptar(false);
        pedido.setRepartoExterno(false);
        pedido.setOrigen("WEB");

        pasarA(DeliveryStatus.CONFIRMADO);
        verify(inventoryService, never()).venderLinea(any(), any());

        pasarA(DeliveryStatus.CANCELADO);
        verify(inventoryService).devolverLinea(eq(linea), eq(branchId), anyBoolean(), any());
    }
}
