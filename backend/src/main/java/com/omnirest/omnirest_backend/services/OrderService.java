package com.omnirest.omnirest_backend.services;

import com.omnirest.omnirest_backend.domain.entities.*;
import com.omnirest.omnirest_backend.domain.enums.OrderStatus;
import com.omnirest.omnirest_backend.domain.enums.OrderType;
import com.omnirest.omnirest_backend.domain.enums.TableStatus;
import com.omnirest.omnirest_backend.domain.enums.KitchenStatus;
import com.omnirest.omnirest_backend.dtos.*;
import com.omnirest.omnirest_backend.repositories.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
@Transactional
public class OrderService {

    private final OrderRepository orderRepository;
    private final OrderItemRepository orderItemRepository;
    private final TableRepository tableRepository;
    private final ProductRepository productRepository;
    private final CustomerRepository customerRepository;
    private final BranchRepository branchRepository;
    private final UserRepository userRepository;
    private final WhatsappIntegrationService whatsappIntegrationService;
    private final org.springframework.messaging.simp.SimpMessagingTemplate messagingTemplate;
    private final InventoryService inventoryService;
    private final SecurityValidationService securityValidationService;
    private final AdicionalesService adicionalesService;
    private final ColaWhatsapp colaWhatsapp;
    private final PaymentMethodService paymentMethodService;
    private final org.springframework.context.ApplicationEventPublisher eventos;
    private final com.omnirest.omnirest_backend.repositories.PagoRepository pagoRepository;

    public OrderResponseDTO openOrder(UUID branchId, Integer tableNumber) {
        return openOrder(branchId, tableNumber, null);
    }

    public OrderResponseDTO openOrder(UUID branchId, Integer tableNumber, String phoneNumber) {
        Table table = tableRepository.findByBranchIdAndTableNumber(branchId, tableNumber)
                .orElseThrow(() -> new IllegalArgumentException(
                        "Table number " + tableNumber + " not found for branch " + branchId));

        Order order;
        java.util.Optional<Order> existingOrder = orderRepository.findByBranchIdAndTableTableNumberAndStatus(branchId,
                tableNumber, OrderStatus.OPEN);
        if (existingOrder.isPresent()) {
            order = existingOrder.get();
        } else {
            if (table.getStatus() != TableStatus.AVAILABLE) {
                throw new IllegalStateException("Table is not available (current status: " + table.getStatus() + ")");
            }

            table.setStatus(TableStatus.OCCUPIED);
            tableRepository.save(table);

            order = Order.builder()
                    .branch(table.getBranch())
                    .table(table)
                    .status(OrderStatus.OPEN)
                    .totalAmount(BigDecimal.ZERO)
                    .build();
        }

        if (phoneNumber != null && !phoneNumber.trim().isEmpty()) {
            final String telefono = TelefonoMx.canonico(phoneNumber);
            Customer customer = customerRepository
                    .findByRestaurantIdAndPhoneNumber(table.getBranch().getRestaurant().getId(), telefono)
                    .orElseGet(() -> {
                        return customerRepository.save(Customer.builder()
                                .restaurant(table.getBranch().getRestaurant())
                                .phoneNumber(telefono)
                                .name("Cliente")
                                .build());
                    });
            order.setCustomer(customer);
        }

        Order savedOrder = orderRepository.save(order);
        sendTableUpdate(table);
        return mapToResponse(savedOrder);
    }

    public OrderResponseDTO addItems(UUID branchId, UUID orderId, List<OrderItemRequestDTO> itemsDto) {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new IllegalArgumentException("Order not found"));

        if (!order.getBranch().getId().equals(branchId)) {
            throw new IllegalArgumentException("La orden no pertenece a la sucursal especificada.");
        }

        if (order.getStatus() != OrderStatus.OPEN) {
            throw new IllegalStateException("Cannot add items to a " + order.getStatus() + " order");
        }

        UUID restaurantId = order.getBranch().getRestaurant().getId();
        List<GrupoAdicional> grupos = adicionalesService.gruposActivos(restaurantId);

        BigDecimal additionalTotal = BigDecimal.ZERO;
        List<OrderItem> orderItems = new ArrayList<>();

        for (OrderItemRequestDTO itemDto : itemsDto) {
            Product product = productRepository.findById(itemDto.productId())
                    .orElseThrow(() -> new IllegalArgumentException("Product not found: " + itemDto.productId()));

            // Sin esto se podia cargar a una mesa un platillo de otro restaurante.
            if (product.getCategory() == null || product.getCategory().getRestaurant() == null
                    || !product.getCategory().getRestaurant().getId().equals(restaurantId)) {
                throw new IllegalArgumentException("El producto " + product.getName()
                        + " no pertenece a este restaurante.");
            }
            if (product.getActive() != null && !product.getActive()) {
                throw new IllegalStateException("Product " + product.getName() + " is inactive");
            }

            OrderItem orderItem = OrderItem.builder()
                    .order(order)
                    .product(product)
                    .quantity(itemDto.quantity())
                    .unitPrice(product.getPrice())
                    .specialInstructions(itemDto.specialInstructions())
                    .build();
            inventoryService.venderLinea(orderItem, order.getBranch().getId());
            // El mesero elige de la misma ficha que el cliente: mismas reglas.
            adicionalesService.aplicarALinea(orderItem,
                    adicionalesService.resolver(product, itemDto.adicionales(), grupos));
            inventoryService.descontarAdicionales(orderItem, order.getBranch().getId());

            additionalTotal = additionalTotal.add(
                    orderItem.getUnitPrice().multiply(BigDecimal.valueOf(itemDto.quantity())));
            orderItems.add(orderItem);
        }

        orderItemRepository.saveAll(orderItems);

        order.setTotalAmount(order.getTotalAmount().add(additionalTotal));
        Order savedOrder = orderRepository.save(order);
        sendTableUpdate(order.getTable());
        // Sin esto cocina no veia lo que agregaba el mesero hasta recargar.
        messagingTemplate.convertAndSend("/topic/branches/" + branchId + "/kitchen", getKitchenTickets(branchId));
        return mapToResponse(savedOrder);
    }

    @Transactional
    public BillSummaryDTO getBill(UUID branchId, UUID orderId) {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new IllegalArgumentException("Order not found: " + orderId));

        if (!order.getBranch().getId().equals(branchId)) {
            throw new IllegalArgumentException("La orden no pertenece a la sucursal especificada.");
        }

        // Los platillos cancelados no se cobran ni aparecen en el ticket.
        List<OrderItem> items = orderItemRepository.findByOrderId(orderId).stream()
                .filter(item -> item.getKitchenStatus() != KitchenStatus.CANCELLED)
                .collect(Collectors.toList());

        // Recalculate total from live items for accuracy
        BigDecimal total = items.stream()
                .filter(item -> item.getUnitPrice() != null)
                .map(item -> item.getUnitPrice()
                        .multiply(BigDecimal.valueOf(item.getQuantity() != null ? item.getQuantity() : 1)))
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        // Sync persisted total if it differs and order is still OPEN
        if (order.getStatus() == OrderStatus.OPEN && total.compareTo(order.getTotalAmount()) != 0) {
            order.setTotalAmount(total);
            orderRepository.save(order);
        }

        List<OrderItemResponseDTO> itemsDto = items.stream()
                .map(this::mapToItemResponse)
                .collect(Collectors.toList());

        StringBuilder sb = new StringBuilder();
        // El cliente ve el nombre del restaurante, no el del sistema.
        String restaurante = order.getBranch() != null && order.getBranch().getRestaurant() != null
                ? order.getBranch().getRestaurant().getName() : null;
        sb.append("================================\n");
        sb.append("*").append(restaurante != null && !restaurante.isBlank() ? restaurante : "Tu cuenta").append("*\n");
        sb.append("================================\n");
        sb.append("Mesa: ").append(order.getTable() != null ? order.getTable().getTableNumber() : "N/A").append("\n");
        sb.append("Orden ID: ").append(order.getId().toString(), 0, 8).append("...\n");
        String fecha = order.getCreatedAt() != null
                ? order.getCreatedAt().toString().replace("T", " ").substring(0, 19)
                : LocalDateTime.now().toString().replace("T", " ").substring(0, 19);
        sb.append("Fecha: ").append(fecha).append("\n");
        sb.append("--------------------------------\n");
        for (OrderItem item : items) {
            String name = item.getProduct() != null ? item.getProduct().getName() : "Producto desconocido";
            BigDecimal price = item.getUnitPrice() != null ? item.getUnitPrice() : BigDecimal.ZERO;
            int qty = item.getQuantity() != null ? item.getQuantity() : 1;
            sb.append(qty).append("x ").append(name)
                    .append(" ($").append(price).append(") : $")
                    .append(price.multiply(BigDecimal.valueOf(qty))).append("\n");
            // El precio de la linea ya incluye los adicionales: se listan para
            // que el cliente vea por que el platillo cuesta mas que en la carta.
            for (String adicional : item.adicionalesParaMostrar()) {
                sb.append("  + ").append(adicional).append("\n");
            }
            if (item.getSpecialInstructions() != null && !item.getSpecialInstructions().trim().isEmpty()) {
                sb.append("  ↳ Nota: ").append(item.getSpecialInstructions()).append("\n");
            }
        }
        sb.append("--------------------------------\n");
        sb.append("*TOTAL A PAGAR: $").append(total).append("*\n");
        sb.append("================================\n");

        return new BillSummaryDTO(
                order.getId(),
                order.getTable() != null ? order.getTable().getTableNumber() : null,
                itemsDto,
                total,
                sb.toString(),
                order.getCustomer() != null ? order.getCustomer().getPhoneNumber() : null,
                order.getCuentaEnviadaEn());
    }

    /**
     * El mesero le manda la cuenta al cliente por WhatsApp desde el panel: el
     * detalle, el total y como puede pagar. Si la mesa todavia no tiene el
     * WhatsApp del cliente, se usa el que escriba el mesero y queda ligado a la
     * orden, para que los siguientes avisos tambien le lleguen.
     */
    public BillSummaryDTO enviarCuenta(UUID branchId, UUID orderId, String telefonoEscrito) {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new IllegalArgumentException("Orden no encontrada."));
        if (!order.getBranch().getId().equals(branchId)) {
            throw new IllegalArgumentException("La orden no pertenece a la sucursal especificada.");
        }
        if (order.getStatus() != OrderStatus.OPEN) {
            throw new IllegalStateException("La cuenta ya está cerrada.");
        }

        // Primero lo que no depende del numero: una cuenta vacia no se manda.
        if (getBill(branchId, orderId).items().isEmpty()) {
            throw new IllegalStateException("La cuenta está vacía: no hay nada que cobrar.");
        }

        String telefono = telefonoEscrito != null && !telefonoEscrito.isBlank()
                ? TelefonoMx.canonico(telefonoEscrito) : null;
        // Menos de 10 digitos no es un WhatsApp: "123" no debe ligarse a la mesa.
        if (telefono != null && telefono.replaceAll("\\D", "").length() < 10) {
            throw new IllegalArgumentException("Ese número de WhatsApp no es válido: escribe los 10 dígitos.");
        }
        if (telefono != null && (order.getCustomer() == null
                || !telefono.equals(order.getCustomer().getPhoneNumber()))) {
            final String numero = telefono;
            Customer cliente = customerRepository
                    .findByRestaurantIdAndPhoneNumber(order.getBranch().getRestaurant().getId(), numero)
                    .orElseGet(() -> customerRepository.save(Customer.builder()
                            .restaurant(order.getBranch().getRestaurant())
                            .phoneNumber(numero)
                            .name("Cliente")
                            .totalVisits(0)
                            .build()));
            order.setCustomer(cliente);
        }
        if (order.getCustomer() == null || order.getCustomer().getPhoneNumber() == null
                || order.getCustomer().getPhoneNumber().isBlank()) {
            throw new IllegalArgumentException("Esta mesa no tiene un WhatsApp registrado. Escribe el número del cliente.");
        }

        BillSummaryDTO cuenta = getBill(branchId, orderId);

        StringBuilder mensaje = new StringBuilder("🧾 Aquí está tu cuenta. ¡Gracias por tu visita!\n\n")
                .append(cuenta.formattedBillText());
        List<PaymentMethodDTO> metodos = paymentMethodService.getPaymentMethodsByBranchId(branchId).stream()
                .filter(m -> Boolean.TRUE.equals(m.active()))
                .toList();
        if (!metodos.isEmpty()) {
            mensaje.append("\n💳 *Puedes pagar con:*\n");
            for (PaymentMethodDTO m : metodos) {
                mensaje.append("• ").append(m.name());
                if (m.instructions() != null && !m.instructions().isBlank()) {
                    mensaje.append(": ").append(m.instructions().trim());
                }
                mensaje.append("\n");
            }
            mensaje.append("\nAvísale a tu mesero cómo vas a pagar.");
        }

        // Misma clave: si el mesero la reenvia (agregaron algo), la vieja que no
        // alcanzo a salir se reemplaza y solo llega la vigente.
        colaWhatsapp.encolar(branchId, order.getCustomer().getPhoneNumber(), mensaje.toString(),
                com.omnirest.omnirest_backend.domain.entities.MensajeWhatsapp.Motivo.CUENTA, "cuenta:" + orderId);

        order.setCuentaEnviadaEn(LocalDateTime.now());
        orderRepository.save(order);
        if (order.getTable() != null) {
            sendTableUpdate(order.getTable());
        }
        log.info("Cuenta de la orden {} enviada por WhatsApp a {}", orderId, order.getCustomer().getPhoneNumber());
        return getBill(branchId, orderId);
    }

    public OrderResponseDTO closeOrder(UUID branchId, UUID orderId) {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new IllegalArgumentException("Order not found"));

        if (!order.getBranch().getId().equals(branchId)) {
            throw new IllegalArgumentException("La orden no pertenece a la sucursal especificada.");
        }

        if (order.getStatus() == OrderStatus.CLOSED) {
            throw new IllegalStateException("Order is already closed");
        }

        // Validar que la cocina haya terminado (entregado o cancelado) todos los
        // platillos
        if (order.getOrderItems() != null) {
            boolean hasPendingItems = order.getOrderItems().stream()
                    .anyMatch(item -> item.getKitchenStatus() != null &&
                            ("PENDING".equalsIgnoreCase(item.getKitchenStatus().name()) ||
                                    "PREPARING".equalsIgnoreCase(item.getKitchenStatus().name())));

            if (hasPendingItems) {
                throw new IllegalStateException(
                        "No se puede cerrar la cuenta. Aún hay platillos pendientes o en preparación en la cocina.");
            }
        }

        // Una cuenta con saldo no se cierra sin cobrarla: lo que no pasa por la
        // caja no aparece en el arqueo. Aplica tambien al bot, que ya no puede
        // cerrar una mesa sin que alguien la cobre.
        if (order.getOrderType() == null || order.getOrderType() == OrderType.SALON) {
            BigDecimal pagado = pagoRepository.pagadoDe(orderId);
            BigDecimal falta = totalVivo(orderId).subtract(pagado != null ? pagado : BigDecimal.ZERO);
            if (falta.signum() > 0) {
                throw new IllegalStateException("Cobra la cuenta antes de cerrar la mesa: faltan $"
                        + falta.setScale(2, java.math.RoundingMode.HALF_UP) + ".");
            }
        }

        Table table = order.getTable();
        if (table != null && table.getAssignedUsers() != null && !table.getAssignedUsers().isEmpty()) {
            String waiterNames = table.getAssignedUsers().stream()
                    .map(u -> u.getName() != null && !u.getName().isBlank() ? u.getName() : u.getUsername())
                    .collect(Collectors.joining(", "));
            order.setWaiterName(waiterNames);
        } else {
            order.setWaiterName("Sin asignar");
        }
        // -----------------------------------------------------------

        order.setStatus(OrderStatus.CLOSED);
        order.setClosedAt(LocalDateTime.now());

        order.setStatus(OrderStatus.CLOSED);
        order.setClosedAt(LocalDateTime.now());

        // Un pedido a domicilio no tiene mesa que liberar ni mesero al que
        // avisarle: se cierra y ya.
        Table table1 = order.getTable();
        if (table1 != null) {
            table1.setStatus(TableStatus.AVAILABLE);
            tableRepository.save(table1);

            notifyWaiters(table1.getBranch().getId(), table1.getTableNumber(), "SYSTEM",
                    "✅ MESA LIBERADA:\nLa Mesa " + table1.getTableNumber()
                            + " ha sido cerrada y liberada exitosamente.");
        }

        Order savedOrder = orderRepository.save(order);
        if (table1 != null) {
            sendTableUpdate(table1);
        }
        // Tambien hay que refrescar cocina: al cerrar, la comanda desaparece del
        // tablero. Sin este aviso seguia ahi hasta que alguien recargara.
        messagingTemplate.convertAndSend("/topic/branches/" + branchId + "/kitchen",
                getKitchenTickets(branchId));
        return mapToResponse(savedOrder);
    }

    /** Lo que suma la cuenta con los platillos vivos (sin cancelados), igual que el ticket. */
    private BigDecimal totalVivo(UUID orderId) {
        return orderItemRepository.findByOrderId(orderId).stream()
                .filter(item -> item.getKitchenStatus() != KitchenStatus.CANCELLED)
                .filter(item -> item.getUnitPrice() != null)
                .map(item -> item.getUnitPrice()
                        .multiply(BigDecimal.valueOf(item.getQuantity() != null ? item.getQuantity() : 1)))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    public OrderResponseDTO closeTable(UUID branchId, Integer tableNumber) {
        Order order = orderRepository
                .findByBranchIdAndTableTableNumberAndStatus(branchId, tableNumber, OrderStatus.OPEN)
                .orElseThrow(() -> new IllegalArgumentException(
                        "No open order found for table " + tableNumber + " in branch " + branchId));

        return closeOrder(branchId, order.getId());
    }

    public void addWebhookItems(WebhookOrderRequestDTO request) {
        // Sin platillos nuevos no hay nada que hacer, y sobre todo no hay que
        // abrir mesa ni tocar la orden. Se sale antes de cualquier cambio.
        if (request == null || request.items() == null || request.items().isEmpty()) {
            log.info("Webhook de pedido sin platillos nuevos: no se modifica nada.");
            return;
        }

        UUID branchId = request.branchId();
        // Canonico: el bot manda el numero con el 1 que antepone WhatsApp y el
        // menu web lo manda sin el. Es la misma persona.
        String phoneNumber = TelefonoMx.canonico(request.phoneNumber());

        Branch branch = branchRepository.findById(branchId)
                .orElseThrow(() -> new IllegalArgumentException("Branch not found: " + branchId));
        UUID restaurantId = branch.getRestaurant().getId();

        Customer customer = customerRepository.findByRestaurantIdAndPhoneNumber(restaurantId, phoneNumber)
                .orElseThrow(() -> new IllegalArgumentException(
                        "Customer not found with phone number " + phoneNumber + " in restaurant " + restaurantId));

        Order order = orderRepository
                // Solo cuentas de mesa: si el cliente tiene un pedido a domicilio abierto,
                // lo que pide en el restaurante no se le debe sumar a ese pedido.
                .findFirstByBranchIdAndCustomerPhoneNumberAndStatusAndOrderTypeOrderByCreatedAtDesc(
                        branchId, phoneNumber, OrderStatus.OPEN, com.omnirest.omnirest_backend.domain.enums.OrderType.SALON)
                .orElseGet(() -> {
                    return orderRepository
                            .findByBranchIdAndTableTableNumberAndStatus(branchId, request.tableNumber(),
                                    OrderStatus.OPEN)
                            .map(existingOrder -> {
                                existingOrder.setCustomer(customer);
                                return orderRepository.save(existingOrder);
                            })
                            .orElseGet(() -> {
                                Table table = tableRepository
                                        .findByBranchIdAndTableNumber(branchId, request.tableNumber())
                                        .orElseThrow(() -> new IllegalArgumentException("Table number "
                                                + request.tableNumber() + " not found for branch " + branchId));

                                table.setStatus(TableStatus.OCCUPIED);
                                tableRepository.save(table);

                                Order newOrder = Order.builder()
                                        .branch(branch)
                                        .table(table)
                                        .customer(customer)
                                        .status(OrderStatus.OPEN)
                                        .totalAmount(BigDecimal.ZERO)
                                        .build();

                                return orderRepository.save(newOrder);
                            });
                });

        List<GrupoAdicional> grupos = adicionalesService.gruposActivos(restaurantId);
        BigDecimal additionalTotal = BigDecimal.ZERO;
        List<OrderItem> orderItems = new java.util.ArrayList<>();

        for (WebhookOrderItemDTO itemDto : request.items()) {
            String rawName = itemDto.product_name();
            if (rawName == null) {
                throw new IllegalArgumentException("Product name cannot be null");
            }

            Product product = buscarProducto(restaurantId, rawName);

            // El bot pide por nombre y puede equivocarse: lo que no se reconoce
            // no tumba el pedido, llega a cocina como aviso para confirmarlo.
            AdicionalesService.EleccionBot eleccion =
                    adicionalesService.resolverPorNombre(product, itemDto.adicionales(), grupos);

            OrderItem orderItem = OrderItem.builder()
                    .order(order)
                    .product(product)
                    .quantity(itemDto.quantity())
                    .unitPrice(product.getPrice())
                    .specialInstructions(conAvisos(itemDto.special_instructions(), eleccion.avisos()))
                    .build();
            inventoryService.venderLinea(orderItem, order.getBranch().getId());
            adicionalesService.aplicarALinea(orderItem, eleccion.eleccion());
            inventoryService.descontarAdicionales(orderItem, order.getBranch().getId());

            additionalTotal = additionalTotal.add(
                    orderItem.getUnitPrice().multiply(BigDecimal.valueOf(itemDto.quantity())));
            orderItems.add(orderItem);
        }

        orderItemRepository.saveAll(orderItems);
        order.setTotalAmount(order.getTotalAmount().add(additionalTotal));
        orderRepository.save(order);
        sendTableUpdate(order.getTable());
        messagingTemplate.convertAndSend("/topic/branches/" + branchId + "/kitchen", getKitchenTickets(branchId));
    }

    /** Suma los avisos del bot a la nota del platillo, que es lo que lee cocina. */
    private static String conAvisos(String nota, List<String> avisos) {
        if (avisos == null || avisos.isEmpty()) return nota;
        String texto = "⚠ " + String.join(" · ", avisos);
        return nota == null || nota.isBlank() ? texto : nota.trim() + " | " + texto;
    }

    public void notifyWaiters(UUID branchId, Integer tableNumber, String type, String message) {
        Table table = tableRepository.findByBranchIdAndTableNumber(branchId, tableNumber).orElse(null);
        if (table == null)
            return;

        // 1. Notificación WebSocket al Dashboard
        List<UUID> assignedUserIds = table.getAssignedUsers() != null
                ? table.getAssignedUsers().stream().map(com.omnirest.omnirest_backend.domain.entities.User::getId)
                        .toList()
                : List.of();

        TableAlertDTO alertDTO = new TableAlertDTO(tableNumber, type, message, assignedUserIds);
        messagingTemplate.convertAndSend("/topic/branches/" + branchId + "/alerts", alertDTO);

        // 2. Extracción segura de teléfonos de meseros en el hilo principal
        List<String> waiterPhones = new java.util.ArrayList<>();
        if (table.getAssignedUsers() != null) {
            for (com.omnirest.omnirest_backend.domain.entities.User waiter : table.getAssignedUsers()) {
                if (waiter.getPhoneNumber() != null && !waiter.getPhoneNumber().isBlank()) {
                    waiterPhones.add(waiter.getPhoneNumber().replace("+", "").replaceAll("\\s+", ""));
                }
            }
        }

        if (waiterPhones.isEmpty())
            return;

        for (String phone : waiterPhones) {
            colaWhatsapp.encolar(branchId, phone, "🔔 ALERTA:\n" + message, com.omnirest.omnirest_backend.domain.entities.MensajeWhatsapp.Motivo.ALERTA_MESERO, null);
        }
    }

    // No es de solo lectura: al armar el ticket se corrige el total guardado si
    // venia desfasado, por ejemplo tras cancelar un platillo.
    @Transactional
    public BillSummaryDTO getBillForTable(UUID branchId, Integer tableNumber) {
        Order order = orderRepository
                .findByBranchIdAndTableTableNumberAndStatus(branchId, tableNumber, OrderStatus.OPEN)
                .orElseThrow(() -> new IllegalArgumentException(
                        "No hay una orden activa para la mesa " + tableNumber + " en la sucursal " + branchId));

        Table table = order.getTable();
        if (table == null) {
            throw new IllegalStateException("La orden activa no tiene una mesa asociada");
        }

        // 1. Generamos el ticket primero
        BillSummaryDTO bill = getBill(branchId, order.getId());

        // 2. Enviamos el texto completo del ticket al mesero en la notificación
        String ticketText = bill.formattedBillText() != null ? bill.formattedBillText()
                : "Mesa " + tableNumber + " ha pedido la cuenta.";
        notifyWaiters(branchId, tableNumber, "BILL",
                "🔔 ALERTA DE COBRO - Mesa " + tableNumber + "\n\n" + ticketText);

        return bill;
    }

    public void notifyPaymentIntent(UUID branchId, Integer tableNumber, String paymentMethod) {
        String methodStr = paymentMethod != null && !paymentMethod.isBlank() ? paymentMethod : "No especificado";
        String message = "💳 ALERTA DE PAGO - Mesa " + tableNumber + "\n"
                + "El cliente está listo para pagar.\n"
                + "Método elegido: " + methodStr;

        notifyWaiters(branchId, tableNumber, "PAYMENT_INTENT", message);
    }

    @Transactional(readOnly = true)
    public Page<OrderResponseDTO> getOrderHistory(UUID branchId, int page, int size) {
        Pageable pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());
        Page<Order> ordersPage = orderRepository.findAllOrdersWithDetailsByBranch(branchId, pageable);
        return ordersPage.map(this::mapToResponse);
    }

    private OrderResponseDTO mapToResponse(Order order) {
        return new OrderResponseDTO(
                order.getId(),
                order.getBranch() != null ? order.getBranch().getId() : null,
                order.getBranch() != null ? order.getBranch().getName() : null,
                order.getTable() != null ? order.getTable().getId() : null,
                order.getTable() != null ? order.getTable().getTableNumber() : null,
                order.getStatus(),
                order.getTotalAmount(),
                order.getCreatedAt(),
                order.getClosedAt(),
                order.getWaiterName() // <--- NUEVO MAPEADO
        );
    }

    private OrderItemResponseDTO mapToItemResponse(OrderItem item) {
        return new OrderItemResponseDTO(
                item.getId(),
                item.getProduct().getId(),
                item.getProduct().getName(),
                item.getQuantity(),
                item.getUnitPrice(),
                item.getSpecialInstructions(),
                item.adicionalesParaMostrar());
    }

    private void sendTableUpdate(Table table) {
        UUID activeOrderId = orderRepository.findByBranchIdAndTableTableNumberAndStatus(
                table.getBranch().getId(),
                table.getTableNumber(),
                OrderStatus.OPEN).map(Order::getId).orElse(null);

        java.math.BigDecimal totalAmount = java.math.BigDecimal.ZERO;
        List<com.omnirest.omnirest_backend.dtos.OrderItemResponseDTO> items = java.util.List.of();
        KitchenStatus kitchenStatus = null;
        java.time.LocalDateTime abiertaDesde = null;

        if (activeOrderId != null) {
            Order order = orderRepository.findById(activeOrderId).orElse(null);
            if (order != null) {
                totalAmount = order.getTotalAmount();
                abiertaDesde = order.getCreatedAt();
                List<OrderItem> dbItems = orderItemRepository.findByOrderId(activeOrderId);
                kitchenStatus = KitchenSummary.resumir(dbItems);
                if (dbItems != null) {
                    items = dbItems.stream()
                            // Un platillo cancelado ya no forma parte de la cuenta.
                            .filter(item -> item.getKitchenStatus() != KitchenStatus.CANCELLED)
                            .map(item -> new com.omnirest.omnirest_backend.dtos.OrderItemResponseDTO(
                                    item.getId(),
                                    item.getProduct().getId(),
                                    item.getProduct().getName(),
                                    item.getQuantity(),
                                    item.getUnitPrice(),
                                    item.getSpecialInstructions(),
                                    item.adicionalesParaMostrar()))
                            .collect(Collectors.toList());
                }
            }
        }

        List<com.omnirest.omnirest_backend.dtos.WaiterSummaryDTO> assignedWaiters = table.getAssignedUsers() != null
                ? table.getAssignedUsers().stream()
                        .map(u -> new com.omnirest.omnirest_backend.dtos.WaiterSummaryDTO(
                                u.getId(),
                                u.getName() != null && !u.getName().isBlank() ? u.getName() : u.getUsername()))
                        .collect(Collectors.toList())
                : List.of();

        com.omnirest.omnirest_backend.dtos.TableResponseDTO payload = new com.omnirest.omnirest_backend.dtos.TableResponseDTO(
                table.getId(),
                table.getBranch().getId(),
                table.getTableNumber(),
                table.getStatus(),
                activeOrderId,
                totalAmount,
                items,
                table.getQrToken(),
                assignedWaiters,
                kitchenStatus,
                abiertaDesde);
        messagingTemplate.convertAndSend("/topic/branches/" + table.getBranch().getId() + "/tables", payload);
    }

    @Transactional(readOnly = true)
    public List<KitchenTicketDTO> getKitchenTickets(UUID branchId) {
        List<Order> activeOrders = orderRepository.findActiveOrdersWithDetailsByBranch(branchId);
        List<KitchenTicketDTO> tickets = new java.util.ArrayList<>();

        for (Order order : activeOrders) {
            List<KitchenTicketItemDTO> items = new java.util.ArrayList<>();
            if (order.getOrderItems() != null) {
                for (OrderItem item : order.getOrderItems()) {
                    if (item.getKitchenStatus() != KitchenStatus.CANCELLED) {
                        items.add(new KitchenTicketItemDTO(
                                item.getId(),
                                item.getProduct().getName(),
                                item.getQuantity(),
                                item.getSpecialInstructions(),
                                item.getKitchenStatus(),
                                item.adicionalesParaMostrar()));
                    }
                }
            }
            if (!items.isEmpty()) {
                // Un pedido a domicilio no tiene mesa, asi que la etiqueta es lo
                // que cocina lee para saber a donde va el platillo.
                Integer mesa = order.getTable() != null ? order.getTable().getTableNumber() : null;
                tickets.add(new KitchenTicketDTO(
                        order.getId(),
                        mesa,
                        order.getCreatedAt(),
                        items,
                        order.getOrderType(),
                        etiquetaDeCocina(order, mesa)));
            }
        }
        return tickets;
    }

    /**
     * Como se identifica el ticket en el tablero: "Mesa 5", "Domicilio ABC12345"
     * o "Para llevar". El token va en la etiqueta porque es el mismo codigo que
     * el cliente trae, y asi cocina y mostrador hablan del mismo pedido.
     */
    private String etiquetaDeCocina(Order order, Integer mesa) {
        if (order.getOrderType() == null || order.getOrderType() == OrderType.SALON) {
            return mesa != null ? "Mesa " + mesa : "Sin mesa";
        }
        // Mostrador (kiosko o para recoger): se llama por turno y cocina necesita
        // saber si emplata o empaca.
        if (order.getTurno() != null) {
            return "Turno " + order.getTurno() + ("AQUI".equals(order.getConsumo()) ? " · Aquí" : " · Para llevar");
        }
        String base = order.getOrderType() == OrderType.DOMICILIO ? "Domicilio" : "Para llevar";
        return order.getTokenSeguimiento() != null ? base + " " + order.getTokenSeguimiento() : base;
    }

    @Transactional
    public void updateKitchenStatus(UUID branchId, UUID itemId, KitchenStatus status) {
        OrderItem item = orderItemRepository.findById(itemId)
                .orElseThrow(() -> new IllegalArgumentException("Order item not found: " + itemId));

        if (!item.getOrder().getBranch().getId().equals(branchId)) {
            throw new org.springframework.security.access.AccessDeniedException(
                    "El ítem no pertenece a la sucursal especificada.");
        }

        KitchenStatus previousStatus = item.getKitchenStatus();
        item.setKitchenStatus(status);
        orderItemRepository.save(item);

        if (status == KitchenStatus.CANCELLED && previousStatus != KitchenStatus.CANCELLED) {
            // Si cocina ya lo habia empezado, la comida se tiro: queda como merma.
            boolean yaPreparado = previousStatus != null && previousStatus != KitchenStatus.PENDING;
            inventoryService.devolverLinea(item, item.getOrder().getBranch().getId(), yaPreparado, "cancelado en cocina");
            inventoryService.devolverAdicionales(item, item.getOrder().getBranch().getId(), yaPreparado, "cancelado en cocina");
            descontarDelTotal(item);
            triggerWhatsappItemCancelNotification(item);
        }

        if (status == KitchenStatus.READY && previousStatus != KitchenStatus.READY) {
            item.setReadyAt(LocalDateTime.now());
            Table table = item.getOrder().getTable();
            String productName = item.getProduct() != null ? item.getProduct().getName() : "Producto";
            int quantity = item.getQuantity() != null ? item.getQuantity() : 1;

            String message = "🍽️ ¡Pedido Listo en Cocina!\n"
                    + quantity + "x " + productName + "\n"
                    + "Mesa: " + (table != null ? table.getTableNumber() : "N/A") + "\n"
                    + "Por favor, pasar a recoger.";

            if (table != null && item.getOrder() != null && item.getOrder().getBranch() != null) {
                notifyWaiters(
                        item.getOrder().getBranch().getId(),
                        table.getTableNumber(),
                        "KITCHEN_READY",
                        message);
            }
        }

        // Al comensal se le avisa una sola vez por etapa, cuando TODOS los
        // platillos de su orden llegaron a ese estado. Un mensaje por platillo
        // llenaria su WhatsApp en un pedido de varios tiempos.
        if (previousStatus != status) {
            avisarComensalSiTodoElPedidoAvanzo(item.getOrder(), status);
        }

        // La mesa se pinta con el color de cocina, asi que hay que refrescarla
        // tambien, no solo el tablero de cocina.
        if (item.getOrder() != null && item.getOrder().getTable() != null) {
            sendTableUpdate(item.getOrder().getTable());
        }

        messagingTemplate.convertAndSend("/topic/branches/" + branchId + "/kitchen", getKitchenTickets(branchId));

        // El tablero de domicilio muestra el avance de cocina de cada pedido.
        if (item.getOrder() != null && item.getOrder().getOrderType() != null
                && item.getOrder().getOrderType() != OrderType.SALON) {
            eventos.publishEvent(new PedidoDomicilioCambio(branchId));
        }
    }

    /**
     * Quita del total de la cuenta el importe de un platillo cancelado. Sin
     * esto el cliente paga comida que nunca salio de la cocina.
     */
    private void descontarDelTotal(OrderItem item) {
        Order order = item.getOrder();
        if (order == null || item.getUnitPrice() == null) {
            return;
        }
        int cantidad = item.getQuantity() != null ? item.getQuantity() : 1;
        BigDecimal importe = item.getUnitPrice().multiply(BigDecimal.valueOf(cantidad));
        BigDecimal actual = order.getTotalAmount() != null ? order.getTotalAmount() : BigDecimal.ZERO;
        BigDecimal nuevo = actual.subtract(importe);
        if (nuevo.compareTo(BigDecimal.ZERO) < 0) {
            nuevo = BigDecimal.ZERO;
        }
        order.setTotalAmount(nuevo);
        orderRepository.save(order);
        log.info("Platillo cancelado: la cuenta baja de {} a {}.", actual, nuevo);
    }

    /**
     * Busca el producto que pidio el cliente. El nombre lo escribe un modelo de
     * lenguaje, asi que llega con variaciones: en singular, sin acentos, con el
     * precio pegado o con otra capitalizacion. Primero se intenta la busqueda
     * directa y, si falla, se compara con los nombres normalizados del catalogo.
     */
    Product buscarProducto(UUID restaurantId, String rawName) {
        Product producto = encontrarProducto(restaurantId, rawName);
        if (producto == null) {
            return null;
        }
        return producto;
    }

    /**
     * Como buscarProducto, pero sin lanzar error: null si no esta en el menu.
     * El carrito del bot la usa porque una excepcion dentro de este servicio
     * marca la transaccion para deshacerse aunque quien llama la atrape.
     */
    Product encontrarProducto(UUID restaurantId, String rawName) {
        if (rawName == null) return null;
        String limpio = rawName;
        if (limpio.contains("-")) {
            limpio = limpio.substring(0, limpio.indexOf("-"));
        }
        limpio = limpio.trim();

        List<Product> directos = productRepository
                .findByCategoryRestaurantIdAndActiveTrueAndNameContainingIgnoreCase(restaurantId, limpio);
        if (!directos.isEmpty()) {
            return directos.get(0);
        }

        // Cadena vacia = LIKE %% = todo el catalogo activo del restaurante.
        List<Product> catalogo = productRepository
                .findByCategoryRestaurantIdAndActiveTrueAndNameContainingIgnoreCase(restaurantId, "");
        String clave = normalizarNombre(limpio);
        if (clave.isEmpty() || catalogo.isEmpty()) {
            return null;
        }

        Product hallado = null;
        for (Product p : catalogo) {
            if (normalizarNombre(p.getName()).equals(clave)) {
                hallado = p;
                break;
            }
        }
        if (hallado == null) {
            for (Product p : catalogo) {
                String otra = normalizarNombre(p.getName());
                if (otra.startsWith(clave) || clave.startsWith(otra)
                        || otra.contains(clave) || clave.contains(otra)) {
                    hallado = p;
                    break;
                }
            }
        }
        if (hallado == null) {
            // Ultimo recurso: el producto que comparta mas palabras, con al
            // menos dos, para no confundir "pozole rojo" con "pay de guayaba".
            int mejor = 1;
            String[] palabras = clave.split(" ");
            for (Product p : catalogo) {
                String otra = normalizarNombre(p.getName());
                int coincidencias = 0;
                for (String palabra : palabras) {
                    if (!palabra.isBlank() && otra.contains(palabra)) {
                        coincidencias++;
                    }
                }
                if (coincidencias > mejor) {
                    mejor = coincidencias;
                    hallado = p;
                }
            }
        }

        if (hallado == null) {
            return null;
        }
        if (!hallado.getName().equalsIgnoreCase(limpio)) {
            log.info("Producto '{}' emparejado con '{}' del catalogo.", rawName, hallado.getName());
        }
        return hallado;
    }

    /**
     * Deja el nombre comparable: sin acentos, sin signos, en minusculas y sin
     * plurales, para que "taco al pastor" y "Tacos al pastor (orden de 5)"
     * lleguen a la misma forma.
     */
    private static String normalizarNombre(String texto) {
        if (texto == null) {
            return "";
        }
        String base = java.text.Normalizer.normalize(texto, java.text.Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .toLowerCase()
                .replaceAll("[^a-z0-9 ]+", " ")
                .replaceAll("\\s+", " ")
                .trim();
        if (base.isEmpty()) {
            return "";
        }
        StringBuilder sb = new StringBuilder();
        for (String palabra : base.split(" ")) {
            if (palabra.isEmpty()) {
                continue;
            }
            if (palabra.endsWith("es") && palabra.length() > 3) {
                palabra = palabra.substring(0, palabra.length() - 2);
            } else if (palabra.endsWith("s") && palabra.length() > 2) {
                palabra = palabra.substring(0, palabra.length() - 1);
            }
            if (sb.length() > 0) {
                sb.append(' ');
            }
            sb.append(palabra);
        }
        return sb.toString();
    }

    /**
     * Manda un WhatsApp al comensal cuando su pedido completo cambia de etapa.
     * No dice nada si la orden sigue teniendo platillos mas atrasados.
     */
    private void avisarComensalSiTodoElPedidoAvanzo(Order order, KitchenStatus status) {
        if (order == null || order.getBranch() == null || order.getCustomer() == null) {
            return;
        }
        // A quien pidio a domicilio o para llevar le avisa el tablero de reparto,
        // no cocina: el mensaje de aqui habla de "llevarlo a la mesa", y dos
        // avisos por lo mismo serian ruido.
        if (order.getOrderType() != null && order.getOrderType() != OrderType.SALON) {
            return;
        }
        if (status != KitchenStatus.PREPARING && status != KitchenStatus.READY
                && status != KitchenStatus.DELIVERED) {
            return;
        }

        List<OrderItem> platillos = orderItemRepository.findByOrderId(order.getId());
        if (!KitchenSummary.todosAlcanzaron(platillos, status)) {
            return;
        }

        // Solo se avisa si la etapa va mas adelante que la ultima ya avisada.
        // Si se agrega un platillo a un pedido que ya estaba en preparacion, el
        // pedido vuelve a pasar por esa etapa pero el cliente no recibe el
        // mismo mensaje dos veces.
        if (!KitchenSummary.esAvisoNuevo(status, order.getKitchenNotified())) {
            return;
        }
        order.setKitchenNotified(status.name());
        orderRepository.save(order);

        final String numeroCliente = order.getCustomer().getPhoneNumber();
        if (numeroCliente == null || numeroCliente.trim().isEmpty()) {
            return;
        }

        final Integer mesa = order.getTable() != null ? order.getTable().getTableNumber() : null;
        final String texto;
        switch (status) {
            case PREPARING:
                texto = "👨‍🍳 Tu pedido ya está en preparación. Te avisamos en cuanto esté listo.";
                break;
            case READY:
                texto = "✅ ¡Tu pedido está listo!"
                        + (mesa != null ? " Enseguida te lo llevamos a la mesa " + mesa + "." : "");
                break;
            default:
                texto = "🍽️ Tu pedido fue entregado. ¡Buen provecho!";
                break;
        }

        colaWhatsapp.encolar(order.getBranch().getId(), numeroCliente, texto, com.omnirest.omnirest_backend.domain.entities.MensajeWhatsapp.Motivo.ESTADO_PEDIDO,
                "estado:" + order.getId());
    }

    @Transactional
    public OrderResponseDTO cancelOrder(UUID branchId, UUID orderId) {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new IllegalArgumentException("Orden no encontrada con ID: " + orderId));

        if (!order.getBranch().getId().equals(branchId)) {
            throw new IllegalArgumentException("La orden no pertenece a la sucursal especificada.");
        }

        if (order.getStatus() == OrderStatus.CLOSED || order.getStatus() == OrderStatus.CANCELLED) {
            throw new IllegalStateException("La orden ya se encuentra en estado " + order.getStatus());
        }

        order.setStatus(OrderStatus.CANCELLED);
        order.setClosedAt(LocalDateTime.now());

        List<OrderItem> items = orderItemRepository.findByOrderId(orderId);
        if (items != null && !items.isEmpty()) {
            for (OrderItem item : items) {
                if (item.getKitchenStatus() != KitchenStatus.CANCELLED) {
                    boolean yaPreparado = item.getKitchenStatus() != KitchenStatus.PENDING;
                    item.setKitchenStatus(KitchenStatus.CANCELLED);
                    inventoryService.devolverLinea(item, item.getOrder().getBranch().getId(), yaPreparado, "cuenta cancelada");
                    inventoryService.devolverAdicionales(item, item.getOrder().getBranch().getId(), yaPreparado, "cuenta cancelada");
                }
            }
            orderItemRepository.saveAll(items);
        }

        Table table = order.getTable();
        if (table != null) {
            table.setStatus(TableStatus.AVAILABLE);
            tableRepository.save(table);
        }

        Order savedOrder = orderRepository.save(order);

        if (table != null) {
            sendTableUpdate(table);
        }

        messagingTemplate.convertAndSend("/topic/branches/" + branchId + "/kitchen", getKitchenTickets(branchId));

        triggerWhatsappCancelNotification(savedOrder);

        return mapToResponse(savedOrder);
    }

    private void triggerWhatsappCancelNotification(Order order) {
        if (order == null || order.getBranch() == null || order.getTable() == null) {
            return;
        }
        final String branchId = order.getBranch().getId().toString();
        final Integer tableNumber = order.getTable().getTableNumber();
        final String numeroCliente = order.getCustomer() != null ? order.getCustomer().getPhoneNumber() : null;

        if (numeroCliente == null || numeroCliente.trim().isEmpty()) {
            return;
        }

        final String message = "Hola, lamentamos informarte que tu orden en la mesa "
                + tableNumber
                + " ha sido cancelada por el restaurante. Acércate a nuestro personal si tienes dudas.";

        colaWhatsapp.encolar(UUID.fromString(branchId), numeroCliente, message, com.omnirest.omnirest_backend.domain.entities.MensajeWhatsapp.Motivo.CANCELACION, null);
    }

    private void triggerWhatsappItemCancelNotification(OrderItem item) {
        if (item == null || item.getOrder() == null || item.getOrder().getBranch() == null
                || item.getOrder().getTable() == null || item.getProduct() == null) {
            return;
        }
        final String branchId = item.getOrder().getBranch().getId().toString();
        final Integer tableNumber = item.getOrder().getTable().getTableNumber();
        final String productName = item.getProduct().getName();
        final String numeroCliente = item.getOrder().getCustomer() != null
                ? item.getOrder().getCustomer().getPhoneNumber()
                : null;

        if (numeroCliente == null || numeroCliente.trim().isEmpty()) {
            return;
        }

        final String message = "Hola, lamentamos informarte que el producto '" + productName
                + "' de tu orden en la mesa " + tableNumber
                + " ha sido cancelado por falta de disponibilidad. Nuestro personal te asistirá en breve.";

        colaWhatsapp.encolar(UUID.fromString(branchId), numeroCliente, message, com.omnirest.omnirest_backend.domain.entities.MensajeWhatsapp.Motivo.CANCELACION, null);
    }
}