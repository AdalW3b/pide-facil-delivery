package com.omnirest.omnirest_backend.services;

import com.omnirest.omnirest_backend.domain.entities.*;
import com.omnirest.omnirest_backend.domain.enums.KitchenStatus;
import com.omnirest.omnirest_backend.domain.enums.OrderStatus;
import com.omnirest.omnirest_backend.domain.enums.TableStatus;
import com.omnirest.omnirest_backend.dtos.*;
import com.omnirest.omnirest_backend.repositories.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class OrderServiceTest {

    @Mock
    private OrderRepository orderRepository;

    @Mock
    private OrderItemRepository orderItemRepository;

    @Mock
    private TableRepository tableRepository;

    @Mock
    private ProductRepository productRepository;

    @Mock
    private CustomerRepository customerRepository;

    @Mock
    private BranchRepository branchRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private WhatsappIntegrationService whatsappIntegrationService;

    @Mock
    private SimpMessagingTemplate messagingTemplate;

    @Mock
    private InventoryService inventoryService;

    @Mock
    private SecurityValidationService securityValidationService;

    @Mock
    private AdicionalesService adicionalesService;

    @Mock
    private ColaWhatsapp colaWhatsapp;

    @Mock
    private org.springframework.context.ApplicationEventPublisher eventos;

    @InjectMocks
    private OrderService orderService;

    private UUID restaurantId;
    private UUID branchId;
    private UUID orderId;
    private Restaurant restaurant;
    private Branch branch;
    private Table table;
    private Customer customer;
    private Order order;

    @BeforeEach
    void setUp() {
        restaurantId = UUID.randomUUID();
        branchId = UUID.randomUUID();
        orderId = UUID.randomUUID();

        restaurant = Restaurant.builder()
                .id(restaurantId)
                .name("Restaurante Test")
                .build();

        branch = Branch.builder()
                .id(branchId)
                .restaurant(restaurant)
                .name("Sucursal Centro")
                .build();

        table = Table.builder()
                .id(UUID.randomUUID())
                .branch(branch)
                .tableNumber(5)
                .status(TableStatus.OCCUPIED)
                .build();

        customer = Customer.builder()
                .id(UUID.randomUUID())
                .restaurant(restaurant)
                .name("Juan Perez")
                .phoneNumber("5215551234567")
                .build();

        order = Order.builder()
                .id(orderId)
                .branch(branch)
                .table(table)
                .customer(customer)
                .status(OrderStatus.OPEN)
                .totalAmount(new BigDecimal("150.00"))
                .createdAt(LocalDateTime.now())
                .build();
    }

    @Test
    @DisplayName("openOrder opens new order when table is AVAILABLE")
    void openOrder_AvailableTable_CreatesNewOrder() {
        table.setStatus(TableStatus.AVAILABLE);
        when(tableRepository.findByBranchIdAndTableNumber(branchId, 5)).thenReturn(Optional.of(table));
        when(orderRepository.findByBranchIdAndTableTableNumberAndStatus(branchId, 5, OrderStatus.OPEN))
                .thenReturn(Optional.empty());
        when(orderRepository.save(any(Order.class))).thenAnswer(invocation -> {
            Order o = invocation.getArgument(0);
            o.setId(UUID.randomUUID());
            return o;
        });

        OrderResponseDTO response = orderService.openOrder(branchId, 5);

        assertNotNull(response);
        assertEquals(OrderStatus.OPEN, response.status());
        assertEquals(TableStatus.OCCUPIED, table.getStatus());
        verify(tableRepository).save(table);
        verify(orderRepository).save(any(Order.class));
    }

    @Test
    @DisplayName("openOrder returns existing open order if already present")
    void openOrder_ExistingOpenOrder_ReturnsExisting() {
        when(tableRepository.findByBranchIdAndTableNumber(branchId, 5)).thenReturn(Optional.of(table));
        when(orderRepository.findByBranchIdAndTableTableNumberAndStatus(branchId, 5, OrderStatus.OPEN))
                .thenReturn(Optional.of(order));
        when(orderRepository.save(any(Order.class))).thenAnswer(invocation -> invocation.getArgument(0));

        OrderResponseDTO response = orderService.openOrder(branchId, 5);

        assertNotNull(response);
        assertEquals(orderId, response.id());
    }

    @Test
    @DisplayName("openOrder throws IllegalStateException when table is OCCUPIED and no open order exists")
    void openOrder_OccupiedTableNoOrder_ThrowsIllegalStateException() {
        table.setStatus(TableStatus.OCCUPIED);
        when(tableRepository.findByBranchIdAndTableNumber(branchId, 5)).thenReturn(Optional.of(table));
        when(orderRepository.findByBranchIdAndTableTableNumberAndStatus(branchId, 5, OrderStatus.OPEN))
                .thenReturn(Optional.empty());

        assertThrows(IllegalStateException.class, () -> orderService.openOrder(branchId, 5));
    }

    @Test
    @DisplayName("addItems adds items, deducts stock and updates total")
    void addItems_Success_DeductsStockAndUpdatesTotal() {
        Product product = Product.builder()
                .id(UUID.randomUUID())
                .name("Tacos al Pastor")
                .price(new BigDecimal("50.00"))
                .active(true)
                .category(Category.builder().id(UUID.randomUUID()).restaurant(restaurant).name("Tacos").build())
                .build();

        OrderItemRequestDTO itemDto = new OrderItemRequestDTO(product.getId(), 2, "Sin cebolla", null);
        AddItemsRequestDTO request = new AddItemsRequestDTO(List.of(itemDto));

        when(orderRepository.findById(orderId)).thenReturn(Optional.of(order));
        when(productRepository.findById(product.getId())).thenReturn(Optional.of(product));
        when(orderRepository.save(any(Order.class))).thenAnswer(invocation -> invocation.getArgument(0));

        OrderResponseDTO response = orderService.addItems(branchId, orderId, request.items());

        assertNotNull(response);
        assertEquals(new BigDecimal("250.00"), order.getTotalAmount());
        verify(inventoryService).venderLinea(argThat(i -> i.getProduct() == product && i.getQuantity() == 2), eq(branchId));
        verify(orderItemRepository).saveAll(anyList());
    }

    @Test
    @DisplayName("addItems throws IllegalStateException when product is inactive")
    void addItems_InactiveProduct_ThrowsIllegalStateException() {
        Product product = Product.builder()
                .id(UUID.randomUUID())
                .name("Refresco")
                .price(new BigDecimal("25.00"))
                .active(false)
                .category(Category.builder().id(UUID.randomUUID()).restaurant(restaurant).name("Bebidas").build())
                .build();

        OrderItemRequestDTO itemDto = new OrderItemRequestDTO(product.getId(), 1, null, null);

        when(orderRepository.findById(orderId)).thenReturn(Optional.of(order));
        when(productRepository.findById(product.getId())).thenReturn(Optional.of(product));

        assertThrows(IllegalStateException.class, () -> orderService.addItems(branchId, orderId, List.of(itemDto)));
    }

    @Test
    @DisplayName("getBill returns detailed bill summary and formatted ticket text")
    void getBill_Success_ReturnsFormattedBill() {
        Product product = Product.builder()
                .id(UUID.randomUUID())
                .name("Hamburguesa")
                .price(new BigDecimal("100.00"))
                .build();

        OrderItem item = OrderItem.builder()
                .id(UUID.randomUUID())
                .order(order)
                .product(product)
                .quantity(2)
                .unitPrice(new BigDecimal("100.00"))
                .specialInstructions("Extra queso")
                .build();

        when(orderRepository.findById(orderId)).thenReturn(Optional.of(order));
        when(orderItemRepository.findByOrderId(orderId)).thenReturn(List.of(item));

        BillSummaryDTO bill = orderService.getBill(branchId, orderId);

        assertNotNull(bill);
        assertEquals(orderId, bill.orderId());
        assertEquals(new BigDecimal("200.00"), bill.totalAmount());
        assertNotNull(bill.formattedBillText());
        assertTrue(bill.formattedBillText().contains("Hamburguesa"));
        assertTrue(bill.formattedBillText().contains("Extra queso"));
        assertTrue(bill.formattedBillText().contains("TOTAL A PAGAR: $200.00"));
    }

    @Test
    @DisplayName("closeOrder closes order, liberates table and prevents closure if kitchen items pending")
    void closeOrder_PendingKitchenItems_ThrowsIllegalStateException() {
        OrderItem pendingItem = OrderItem.builder()
                .id(UUID.randomUUID())
                .kitchenStatus(KitchenStatus.PREPARING)
                .build();
        order.setOrderItems(List.of(pendingItem));

        when(orderRepository.findById(orderId)).thenReturn(Optional.of(order));

        IllegalStateException ex = assertThrows(
                IllegalStateException.class,
                () -> orderService.closeOrder(branchId, orderId)
        );

        assertTrue(ex.getMessage().contains("Aún hay platillos pendientes"));
    }

    @Test
    @DisplayName("closeOrder succeeds when all kitchen items are ready/served")
    void closeOrder_AllItemsDelivered_Success() {
        OrderItem deliveredItem = OrderItem.builder()
                .id(UUID.randomUUID())
                .kitchenStatus(KitchenStatus.DELIVERED)
                .build();
        order.setOrderItems(List.of(deliveredItem));

        when(orderRepository.findById(orderId)).thenReturn(Optional.of(order));
        when(tableRepository.findByBranchIdAndTableNumber(eq(branchId), eq(5))).thenReturn(Optional.of(table));
        when(orderRepository.save(any(Order.class))).thenAnswer(invocation -> invocation.getArgument(0));

        OrderResponseDTO response = orderService.closeOrder(branchId, orderId);

        assertNotNull(response);
        assertEquals(OrderStatus.CLOSED, response.status());
        assertEquals(TableStatus.AVAILABLE, table.getStatus());
        assertNotNull(order.getClosedAt());
        verify(tableRepository).save(table);
    }

    @Test
    @DisplayName("cancelOrder cancels order, frees table, restores stock and triggers async WhatsApp notification")
    void cancelOrder_Success_CancelsOrderAndTriggersAsyncWhatsappNotification() {
        Product product = Product.builder()
                .id(UUID.randomUUID())
                .name("Hamburguesa Clásica")
                .price(new BigDecimal("150.00"))
                .build();

        OrderItem item = OrderItem.builder()
                .id(UUID.randomUUID())
                .order(order)
                .product(product)
                .quantity(1)
                .unitPrice(new BigDecimal("150.00"))
                .kitchenStatus(KitchenStatus.PREPARING)
                .build();

        when(orderRepository.findById(orderId)).thenReturn(Optional.of(order));
        when(orderItemRepository.findByOrderId(orderId)).thenReturn(new ArrayList<>(List.of(item)));
        when(orderRepository.save(any(Order.class))).thenAnswer(invocation -> invocation.getArgument(0));

        OrderResponseDTO response = orderService.cancelOrder(branchId, orderId);

        assertNotNull(response);
        assertEquals(OrderStatus.CANCELLED, response.status());
        assertEquals(OrderStatus.CANCELLED, order.getStatus());
        assertNotNull(order.getClosedAt());
        assertEquals(TableStatus.AVAILABLE, table.getStatus());

        verify(inventoryService).devolverLinea(item, branchId);
        verify(orderItemRepository).saveAll(anyList());
        verify(tableRepository).save(table);
        verify(messagingTemplate, atLeastOnce()).convertAndSend(contains("/kitchen"), any(Object.class));

        // El aviso al cliente va a la cola de WhatsApp, que se encarga de
        // enviarlo y de reintentar si WhatsApp esta caido.
        verify(colaWhatsapp).encolar(
                eq(branchId),
                eq("5215551234567"),
                contains("cancelada"),
                eq(com.omnirest.omnirest_backend.domain.entities.MensajeWhatsapp.Motivo.CANCELACION),
                any());
    }

    @Test
    @DisplayName("cancelOrder throws IllegalArgumentException when branch ID does not match (IDOR)")
    void cancelOrder_DifferentBranch_ThrowsIllegalArgumentException() {
        UUID anotherBranchId = UUID.randomUUID();
        when(orderRepository.findById(orderId)).thenReturn(Optional.of(order));

        IllegalArgumentException ex = assertThrows(
                IllegalArgumentException.class,
                () -> orderService.cancelOrder(anotherBranchId, orderId)
        );

        assertEquals("La orden no pertenece a la sucursal especificada.", ex.getMessage());
        verifyNoInteractions(whatsappIntegrationService);
    }

    @Test
    @DisplayName("cancelOrder throws IllegalStateException when order is already CLOSED or CANCELLED")
    void cancelOrder_AlreadyCancelledOrClosed_ThrowsIllegalStateException() {
        order.setStatus(OrderStatus.CLOSED);
        when(orderRepository.findById(orderId)).thenReturn(Optional.of(order));

        IllegalStateException ex = assertThrows(
                IllegalStateException.class,
                () -> orderService.cancelOrder(branchId, orderId)
        );

        assertTrue(ex.getMessage().contains("La orden ya se encuentra en estado"));
        verifyNoInteractions(whatsappIntegrationService);
    }
}
