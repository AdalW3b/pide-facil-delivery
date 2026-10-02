package com.omnirest.omnirest_backend.services;

import com.omnirest.omnirest_backend.domain.entities.*;
import com.omnirest.omnirest_backend.domain.enums.DeliveryStatus;
import com.omnirest.omnirest_backend.domain.enums.OrderType;
import com.omnirest.omnirest_backend.dtos.CambiarEstadoEntregaDTO;
import com.omnirest.omnirest_backend.repositories.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** Un pedido de Rappi entra al tablero de Domicilio, ligado al menu y sin tocar inventario. */
class RappiServiceTest {

    private final UUID branchId = UUID.randomUUID();
    private final Restaurant restaurante = Restaurant.builder().id(UUID.randomUUID()).name("Fonda").build();
    private final Branch sucursal = Branch.builder().id(branchId).restaurant(restaurante).active(true).build();
    private final Category tacos = Category.builder().id(UUID.randomUUID()).name("Tacos").restaurant(restaurante).build();
    private final Product pastor = Product.builder().id(UUID.randomUUID()).name("Taco de pastor")
            .price(new BigDecimal("25.00")).category(tacos).active(true).build();
    private final Product gringa = Product.builder().id(UUID.randomUUID()).name("Gringa")
            .price(new BigDecimal("70.00")).category(tacos).active(true).build();
    private final Adicional queso = Adicional.builder().id(UUID.randomUUID()).nombre("Queso extra")
            .precio(new BigDecimal("12.00")).activo(true).build();
    private final GrupoAdicional extras = GrupoAdicional.builder().id(UUID.randomUUID()).nombre("Extras")
            .minimo(0).maximo(3).activo(true).opciones(new ArrayList<>(List.of(queso)))
            .categorias(Set.of(tacos)).productos(Set.of()).build();

    private final RappiTiendaRepository tiendaRepository = mock(RappiTiendaRepository.class);
    private final PedidoRappiRepository pedidoRappiRepository = mock(PedidoRappiRepository.class);
    private final BranchRepository branchRepository = mock(BranchRepository.class);
    private final OrderRepository orderRepository = mock(OrderRepository.class);
    private final OrderItemRepository orderItemRepository = mock(OrderItemRepository.class);
    private final ProductRepository productRepository = mock(ProductRepository.class);
    private final AdicionalesService adicionalesService = mock(AdicionalesService.class);
    private final DeliveryService deliveryService = mock(DeliveryService.class);

    private RappiService servicio;
    private final List<OrderItem> lineasGuardadas = new ArrayList<>();

    @BeforeEach
    void setUp() {
        servicio = new RappiService(tiendaRepository, pedidoRappiRepository, branchRepository, orderRepository,
                orderItemRepository, productRepository, adicionalesService, deliveryService);

        queso.setGrupo(extras);
        when(tiendaRepository.findByStoreId("900")).thenReturn(Optional.of(
                RappiTienda.builder().branchId(branchId).storeId("900").build()));
        when(branchRepository.findById(branchId)).thenReturn(Optional.of(sucursal));
        when(productRepository.findById(pastor.getId())).thenReturn(Optional.of(pastor));
        when(productRepository.findByCategoryRestaurantIdAndActiveTrueAndNameContainingIgnoreCase(eq(restaurante.getId()), anyString()))
                .thenAnswer(i -> List.of(pastor, gringa).stream()
                        .filter(p -> p.getName().toLowerCase().contains(i.<String>getArgument(1).toLowerCase()))
                        .toList());
        when(orderRepository.save(any(Order.class))).thenAnswer(i -> {
            Order o = i.getArgument(0);
            if (o.getId() == null) o.setId(UUID.randomUUID());
            return o;
        });
        when(orderItemRepository.saveAll(anyList())).thenAnswer(i -> {
            lineasGuardadas.addAll(i.getArgument(0));
            return i.getArgument(0);
        });
        when(adicionalesService.gruposActivos(restaurante.getId())).thenReturn(List.of(extras));
        when(adicionalesService.resolverExterno(any(), any(), any())).thenCallRealMethod();
        doCallRealMethod().when(adicionalesService).aplicarALinea(any(), any());
    }

    private static String pedido(String orderId, String metodoEntrega, String metodoPago, String items) {
        return """
                {"order_detail": {"order_id": "%s", "delivery_method": "%s", "payment_method": "%s",
                   "cooking_time": 15,
                   "delivery_information": {"complete_address": "Av. Juárez 10, Centro", "complement": "Portón negro"},
                   "totals": {"total_order": 180, "total_to_pay": 180},
                   "items": [%s]},
                 "customer": {"first_name": "María", "last_name": "López"},
                 "store": {"internal_id": "900", "external_id": "x"}}
                """.formatted(orderId, metodoEntrega, metodoPago, items);
    }

    private Order pedidoGuardado() {
        ArgumentCaptor<Order> captor = ArgumentCaptor.forClass(Order.class);
        verify(orderRepository, atLeastOnce()).save(captor.capture());
        return captor.getValue();
    }

    @Test
    @DisplayName("Liga por SKU, cobra lo que cobro Rappi y nace en NUEVO sin descontar inventario")
    void ligaPorSku() {
        String items = """
                {"sku": "%s", "name": "Pastor (Rappi)", "price": 30, "quantity": 2, "comments": "Sin cebolla",
                 "subitems": [{"sku": "%s", "name": "Queso", "price": 15, "quantity": 1}]}
                """.formatted(pastor.getId(), queso.getId());

        List<UUID> creados = servicio.recibirPedidos(pedido("R-1", "delivery", "cc", items));

        assertEquals(1, creados.size());
        Order o = pedidoGuardado();
        assertEquals("RAPPI", o.getOrigen());
        assertEquals(OrderType.DOMICILIO, o.getOrderType());
        assertEquals(DeliveryStatus.NUEVO, o.getDeliveryStatus());
        assertNull(o.getCustomer(), "el cliente de Rappi no se guarda como nuestro");
        assertEquals("María L.", o.getClienteExterno());
        assertEquals("R-1", o.getPedidoExterno());
        assertTrue(o.getDescontarAlAceptar());
        assertTrue(o.getRepartoExterno());
        assertEquals(15, o.getMinutosEstimados());
        assertNotNull(o.getTokenSeguimiento());
        assertNotEquals("R-1", o.getTokenSeguimiento(), "el token abre el enlace del repartidor: no debe adivinarse");

        assertEquals(1, lineasGuardadas.size());
        OrderItem linea = lineasGuardadas.get(0);
        assertEquals(pastor, linea.getProduct());
        assertEquals(0, new BigDecimal("45").compareTo(linea.getUnitPrice()), "30 + 15 de queso, precio de Rappi");
        assertEquals("Sin cebolla", linea.getSpecialInstructions());
        assertEquals(1, linea.getAdicionales().size());
        assertEquals(queso.getId(), linea.getAdicionales().get(0).getAdicionalId());
        assertEquals(0, new BigDecimal("15").compareTo(linea.getAdicionales().get(0).getPrecio()));
        assertEquals(0, new BigDecimal("90").compareTo(o.getTotalAmount()));

        ArgumentCaptor<PedidoRappi> rappi = ArgumentCaptor.forClass(PedidoRappi.class);
        verify(pedidoRappiRepository).save(rappi.capture());
        assertEquals("R-1", rappi.getValue().getRappiOrderId());
        assertEquals(o.getId(), rappi.getValue().getOrderId());
        assertEquals("900", rappi.getValue().getStoreId());
        assertNull(rappi.getValue().getSinLigar());
        assertTrue(rappi.getValue().getPayload().contains("\"R-1\""));
        verify(deliveryService).publicarTableroDe(branchId);
    }

    @Test
    @DisplayName("Sin SKU liga por nombre exacto; lo que no reconoce llega como aviso, sin adivinar")
    void ligaPorNombreYAvisa() {
        String items = """
                {"name": "GRINGA", "price": 70, "quantity": 1,
                 "subitems": [{"name": "Piña asada", "price": 5, "quantity": 1}]},
                {"name": "Taco", "price": 20, "quantity": 3}
                """;

        servicio.recibirPedidos(pedido("R-2", "delivery", "cc", items));

        assertEquals(1, lineasGuardadas.size());
        OrderItem linea = lineasGuardadas.get(0);
        assertEquals(gringa, linea.getProduct());
        assertTrue(linea.getSpecialInstructions().contains("Piña asada"), "el topping desconocido va a cocina");
        assertEquals(0, new BigDecimal("75").compareTo(linea.getUnitPrice()), "se cobra lo que cobro Rappi");

        Order o = pedidoGuardado();
        assertTrue(o.getNotasEntrega().contains("3× Taco"), "\"Taco\" no se liga a \"Taco de pastor\"");
        ArgumentCaptor<PedidoRappi> rappi = ArgumentCaptor.forClass(PedidoRappi.class);
        verify(pedidoRappiRepository).save(rappi.capture());
        assertEquals("3× Taco", rappi.getValue().getSinLigar());
    }

    @Test
    @DisplayName("Para recoger y en efectivo: para llevar, sin direccion y con lo que hay que cobrar")
    void paraRecogerEnEfectivo() {
        servicio.recibirPedidos(pedido("R-3", "pickup", "cash",
                "{\"sku\": \"" + pastor.getId() + "\", \"name\": \"Pastor\", \"price\": 25, \"quantity\": 1}"));

        Order o = pedidoGuardado();
        assertEquals(OrderType.PARA_LLEVAR, o.getOrderType());
        assertNull(o.getDireccionEntrega());
        assertFalse(o.getRepartoExterno());
        assertTrue(o.getNotasEntrega().contains("Cobrar $180 en efectivo"));
    }

    @Test
    @DisplayName("Repartidor propio con tarjeta: avisa que no se cobra")
    void marketplacePagado() {
        servicio.recibirPedidos(pedido("R-4", "marketplace", "cc",
                "{\"sku\": \"" + pastor.getId() + "\", \"name\": \"Pastor\", \"price\": 25, \"quantity\": 1}"));

        Order o = pedidoGuardado();
        assertFalse(o.getRepartoExterno(), "lo lleva un repartidor de la sucursal");
        assertEquals("Av. Juárez 10, Centro", o.getDireccionEntrega());
        assertEquals("Portón negro", o.getReferenciasEntrega());
        assertTrue(o.getNotasEntrega().contains("no cobrar al cliente"));
    }

    @Test
    @DisplayName("Un aviso repetido no crea otro pedido")
    void ignoraRepetidos() {
        when(pedidoRappiRepository.existsByRappiOrderId("R-1")).thenReturn(true);

        assertTrue(servicio.recibirPedidos(pedido("R-1", "delivery", "cc", "")).isEmpty());
        verify(orderRepository, never()).save(any());
        verify(pedidoRappiRepository, never()).save(any());
    }

    @Test
    @DisplayName("Una tienda sin ligar no crea nada")
    void tiendaSinLigar() {
        String otraTienda = pedido("R-5", "delivery", "cc", "").replace("\"900\"", "\"901\"");
        assertThrows(IllegalArgumentException.class, () -> servicio.recibirPedidos(otraTienda));
        verify(orderRepository, never()).save(any());
    }

    @Test
    @DisplayName("Si Rappi lo cancela, sale del tablero; si ya estaba cerrado, no se toca")
    void cancelacion() {
        UUID orderId = UUID.randomUUID();
        Order abierto = Order.builder().id(orderId).branch(sucursal).deliveryStatus(DeliveryStatus.NUEVO).build();
        when(pedidoRappiRepository.findByRappiOrderId("R-6")).thenReturn(Optional.of(
                PedidoRappi.builder().orderId(orderId).rappiOrderId("R-6").storeId("900").payload("{}").build()));
        when(orderRepository.findById(orderId)).thenReturn(Optional.of(abierto));

        servicio.cancelar("{\"event\": \"canceled_with_charge\", \"order_id\": \"R-6\", \"store_id\": \"900\"}");

        ArgumentCaptor<CambiarEstadoEntregaDTO> cambio = ArgumentCaptor.forClass(CambiarEstadoEntregaDTO.class);
        verify(deliveryService).cambiarEstado(eq(branchId), eq(orderId), cambio.capture());
        assertEquals(DeliveryStatus.CANCELADO, cambio.getValue().estado());

        abierto.setDeliveryStatus(DeliveryStatus.ENTREGADO);
        servicio.cancelar("{\"event\": \"canceled_with_charge\", \"order_id\": \"R-6\"}");
        verify(deliveryService, times(1)).cambiarEstado(any(), any(), any());
    }

    @Test
    @DisplayName("Ligar: una tienda de Rappi no puede quedar en dos sucursales")
    void ligarTienda() {
        when(tiendaRepository.findById(any())).thenReturn(Optional.empty());
        when(tiendaRepository.save(any())).thenAnswer(i -> i.getArgument(0));

        assertThrows(IllegalStateException.class, () -> servicio.ligar(UUID.randomUUID(), "900"));
        assertThrows(IllegalArgumentException.class, () -> servicio.ligar(branchId, "con espacios"));
        assertEquals("900", servicio.ligar(branchId, " 900 ").getStoreId());
    }
}
