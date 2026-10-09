package com.omnirest.omnirest_backend.services;

import com.omnirest.omnirest_backend.domain.entities.*;
import com.omnirest.omnirest_backend.domain.enums.DeliveryStatus;
import com.omnirest.omnirest_backend.domain.enums.KitchenStatus;
import com.omnirest.omnirest_backend.domain.enums.OrderStatus;
import com.omnirest.omnirest_backend.domain.enums.OrderType;
import com.omnirest.omnirest_backend.dtos.CambiarEstadoEntregaDTO;
import com.omnirest.omnirest_backend.dtos.PedidoDomicilioItemDTO;
import com.omnirest.omnirest_backend.dtos.PedidoMostradorDTOs;
import com.omnirest.omnirest_backend.repositories.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Pedidos de mostrador: lo del kiosko nace por cobrar y sin tocar inventario;
 * pasar a recoger nace como los del menu web.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class DeliveryServiceMostradorTest {

    @Mock OrderRepository orderRepository;
    @Mock OrderItemRepository orderItemRepository;
    @Mock BranchDeliverySettingsRepository deliverySettingsRepository;
    @Mock InventoryService inventoryService;
    @Mock ColaWhatsapp colaWhatsapp;
    @Mock org.springframework.messaging.simp.SimpMessagingTemplate messagingTemplate;
    @Mock OrderService orderService;
    @Mock BranchRepository branchRepository;
    @Mock CustomerRepository customerRepository;
    @Mock CustomerAddressRepository customerAddressRepository;
    @Mock ProductRepository productRepository;
    @Mock AdicionalesService adicionalesService;
    @Mock FotosService fotosService;
    @Mock PlanLimitService planLimitService;
    @Mock WhatsappIntegrationService whatsappIntegrationService;
    @Mock AgotadosService agotadosService;
    @Mock CajaService cajaService;
    @Mock PagoRepository pagoRepository;
    @Mock Turnos turnos;
    @Mock AreasService areasService;
    @InjectMocks DeliveryService servicio;

    private final UUID branchId = UUID.randomUUID();
    private final Restaurant restaurante = Restaurant.builder().id(UUID.randomUUID()).name("Fonda").build();
    private final Branch sucursal = Branch.builder().id(branchId).restaurant(restaurante).build();
    private final Category tacos = Category.builder().id(UUID.randomUUID()).name("Tacos").restaurant(restaurante).build();
    private final Product pastor = Product.builder().id(UUID.randomUUID()).name("Taco de pastor")
            .price(new BigDecimal("25")).category(tacos).active(true).build();
    private final Kiosko kiosko = Kiosko.builder().id(UUID.randomUUID()).branchId(branchId).nombre("Entrada").build();
    private final List<Order> guardados = new ArrayList<>();

    @BeforeEach
    void setUp() {
        when(branchRepository.findById(branchId)).thenReturn(Optional.of(sucursal));
        when(productRepository.findById(pastor.getId())).thenReturn(Optional.of(pastor));
        when(turnos.siguiente(branchId)).thenReturn("A-023");
        when(orderRepository.save(any(Order.class))).thenAnswer(i -> {
            Order o = i.getArgument(0);
            if (o.getId() == null) o.setId(UUID.randomUUID());
            guardados.add(o);
            return o;
        });
        when(adicionalesService.resolver(any(), any(), any())).thenReturn(AdicionalesService.Eleccion.NINGUNA);
        doAnswer(i -> {
            OrderItem item = i.getArgument(0);
            item.setUnitPrice(item.getProduct().getPrice());
            return null;
        }).when(adicionalesService).aplicarALinea(any(), any());
        when(customerRepository.save(any(Customer.class))).thenAnswer(i -> i.getArgument(0));
    }

    private PedidoMostradorDTOs.Crear pedidoDePastor(String telefono, String consumo) {
        return new PedidoMostradorDTOs.Crear(
                List.of(new PedidoDomicilioItemDTO(pastor.getId(), 2, null, List.of())), "Ana", telefono, consumo, null);
    }

    private Order ultimo() {
        return guardados.get(guardados.size() - 1);
    }

    @Test
    @DisplayName("Kiosko: nace por cobrar, con turno, sin tocar inventario y sin pedir WhatsApp")
    void kiosko() {
        PedidoMostradorDTOs.Creado c = servicio.crearPedidoMostrador(branchId, pedidoDePastor(null, "AQUI"), kiosko);

        assertEquals("A-023", c.turno());
        assertEquals("AQUI", c.consumo());
        assertTrue(c.pagarEnCaja());
        assertEquals(0, new BigDecimal("50").compareTo(c.total()));

        Order o = ultimo();
        assertEquals("KIOSKO", o.getOrigen());
        assertEquals(OrderType.PARA_LLEVAR, o.getOrderType());
        assertEquals(DeliveryStatus.NUEVO, o.getDeliveryStatus());
        assertTrue(o.getDescontarAlAceptar(), "el inventario se descuenta al cobrarse");
        assertEquals("Ana", o.getClienteExterno());
        assertNull(o.getCustomer());
        verify(inventoryService, never()).venderLinea(any(), any());
        verify(planLimitService, never()).checkDeliveryAvailable(any());
    }

    @Test
    @DisplayName("Kiosko: lo agotado se rechaza al pedir aunque no se descuente inventario")
    void kioskoAgotado() {
        when(agotadosService.estaAgotado(branchId, pastor)).thenReturn(true);
        IllegalStateException e = assertThrows(IllegalStateException.class,
                () -> servicio.crearPedidoMostrador(branchId, pedidoDePastor(null, "LLEVAR"), kiosko));
        assertTrue(e.getMessage().contains("se acabó"));
    }

    @Test
    @DisplayName("Paso a recoger: siempre para llevar, pide WhatsApp y descuenta al crearse")
    void recoger() {
        assertThrows(IllegalArgumentException.class,
                () -> servicio.crearPedidoMostrador(branchId, pedidoDePastor("  ", "LLEVAR"), null));

        PedidoMostradorDTOs.Creado c = servicio.crearPedidoMostrador(branchId, pedidoDePastor("5512345678", "AQUI"), null);
        assertEquals("LLEVAR", c.consumo(), "desde el celular no se pide para comer aquí");
        assertFalse(c.pagarEnCaja());
        Order o = ultimo();
        assertEquals("WEB", o.getOrigen());
        assertFalse(o.getDescontarAlAceptar());
        assertNotNull(o.getCustomer(), "con WhatsApp se le avisa cuando esté listo");
        verify(inventoryService).venderLinea(any(), eq(branchId));
        verify(planLimitService, atLeastOnce()).checkDeliveryAvailable(restaurante.getId());
    }

    @Test
    @DisplayName("Lo del kiosko no entra a cocina sin cobrarse")
    void kioskoSinCobrarNoAvanza() {
        Order o = Order.builder().id(UUID.randomUUID()).branch(sucursal).status(OrderStatus.OPEN)
                .orderType(OrderType.PARA_LLEVAR).deliveryStatus(DeliveryStatus.NUEVO).origen("KIOSKO")
                .turno("A-023").descontarAlAceptar(true).build();
        OrderItem linea = OrderItem.builder().id(UUID.randomUUID()).order(o).product(pastor).quantity(2)
                .unitPrice(new BigDecimal("25")).kitchenStatus(KitchenStatus.PENDING).build();
        when(orderRepository.findByIdAndBranchId(o.getId(), branchId)).thenReturn(Optional.of(o));
        when(orderItemRepository.findByOrderId(o.getId())).thenReturn(List.of(linea));
        when(pagoRepository.pagadoDe(o.getId())).thenReturn(BigDecimal.ZERO);

        IllegalStateException e = assertThrows(IllegalStateException.class, () ->
                servicio.cambiarEstado(branchId, o.getId(), new CambiarEstadoEntregaDTO(DeliveryStatus.CONFIRMADO, null)));
        assertTrue(e.getMessage().contains("A-023"));
        verify(inventoryService, never()).venderLinea(any(), any());

        // Cobrado: ahora si, y se descuenta el inventario.
        when(pagoRepository.pagadoDe(o.getId())).thenReturn(new BigDecimal("50"));
        servicio.cambiarEstado(branchId, o.getId(), new CambiarEstadoEntregaDTO(DeliveryStatus.CONFIRMADO, null));
        assertEquals(DeliveryStatus.CONFIRMADO, o.getDeliveryStatus());
        verify(inventoryService).venderLinea(linea, branchId);

        // Cancelarlo sin cobrar si se puede (el cliente se fue).
        Order otro = Order.builder().id(UUID.randomUUID()).branch(sucursal).status(OrderStatus.OPEN)
                .orderType(OrderType.PARA_LLEVAR).deliveryStatus(DeliveryStatus.NUEVO).origen("KIOSKO")
                .turno("A-024").descontarAlAceptar(true).build();
        when(orderRepository.findByIdAndBranchId(otro.getId(), branchId)).thenReturn(Optional.of(otro));
        when(orderItemRepository.findByOrderId(otro.getId())).thenReturn(List.of());
        servicio.cambiarEstado(branchId, otro.getId(), new CambiarEstadoEntregaDTO(DeliveryStatus.CANCELADO, null));
        assertEquals(DeliveryStatus.CANCELADO, otro.getDeliveryStatus());
    }

    @Test
    @DisplayName("Al cliente se le habla de su turno, no del código interno")
    void avisaConTurno() {
        Customer ana = Customer.builder().id(UUID.randomUUID()).phoneNumber("5215512345678").name("Ana").build();
        Order o = Order.builder().id(UUID.randomUUID()).branch(sucursal).customer(ana).status(OrderStatus.OPEN)
                .orderType(OrderType.PARA_LLEVAR).deliveryStatus(DeliveryStatus.CONFIRMADO).origen("KIOSKO")
                .turno("A-023").tokenSeguimiento("XYZ12345").consumo("AQUI").build();
        when(orderRepository.findByIdAndBranchId(o.getId(), branchId)).thenReturn(Optional.of(o));
        when(orderItemRepository.findByOrderId(o.getId())).thenReturn(List.of());
        when(pagoRepository.pagadoDe(any())).thenReturn(BigDecimal.ZERO);

        servicio.cambiarEstado(branchId, o.getId(), new CambiarEstadoEntregaDTO(DeliveryStatus.LISTO, null));

        ArgumentCaptor<String> texto = ArgumentCaptor.forClass(String.class);
        verify(colaWhatsapp).encolar(eq(branchId), eq("5215512345678"), texto.capture(), any(), any());
        assertTrue(texto.getValue().contains("A-023"));
        assertFalse(texto.getValue().contains("XYZ12345"));
    }
}
