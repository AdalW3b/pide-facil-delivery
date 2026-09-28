package com.omnirest.omnirest_backend.services;

import com.omnirest.omnirest_backend.domain.entities.Branch;
import com.omnirest.omnirest_backend.domain.entities.BranchDeliverySettings;
import com.omnirest.omnirest_backend.domain.entities.Customer;
import com.omnirest.omnirest_backend.domain.entities.CustomerAddress;
import com.omnirest.omnirest_backend.domain.entities.Driver;
import com.omnirest.omnirest_backend.domain.entities.Order;
import com.omnirest.omnirest_backend.domain.entities.OrderItem;
import com.omnirest.omnirest_backend.domain.entities.Product;
import com.omnirest.omnirest_backend.domain.enums.DeliveryStatus;
import com.omnirest.omnirest_backend.domain.enums.KitchenStatus;
import com.omnirest.omnirest_backend.domain.enums.OrderStatus;
import com.omnirest.omnirest_backend.domain.enums.OrderType;
import com.omnirest.omnirest_backend.dtos.CambiarEstadoEntregaDTO;
import com.omnirest.omnirest_backend.dtos.CotizacionEnvioResponseDTO;
import com.omnirest.omnirest_backend.dtos.CrearPedidoDomicilioRequestDTO;
import com.omnirest.omnirest_backend.dtos.DeliverySettingsDTO;
import com.omnirest.omnirest_backend.dtos.MenuPublicoCategoriaDTO;
import com.omnirest.omnirest_backend.dtos.KitchenTicketItemDTO;
import com.omnirest.omnirest_backend.dtos.MenuPublicoItemDTO;
import com.omnirest.omnirest_backend.dtos.PedidoDomicilioPanelDTO;
import com.omnirest.omnirest_backend.dtos.PedidoDomicilioItemDTO;
import com.omnirest.omnirest_backend.dtos.PedidoDomicilioResponseDTO;
import com.omnirest.omnirest_backend.repositories.BranchDeliverySettingsRepository;
import com.omnirest.omnirest_backend.repositories.BranchRepository;
import com.omnirest.omnirest_backend.repositories.CustomerAddressRepository;
import com.omnirest.omnirest_backend.repositories.CustomerRepository;
import com.omnirest.omnirest_backend.repositories.OrderItemRepository;
import com.omnirest.omnirest_backend.repositories.OrderRepository;
import com.omnirest.omnirest_backend.repositories.ProductRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Pedidos a domicilio: cotizar el envio antes de pedir y crear el pedido.
 *
 * El cliente entra por un enlace publico con el menu, asi que aqui no hay
 * usuario autenticado: la sucursal viene en la URL y todo lo demas se valida
 * contra ella.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class DeliveryService {

    /** Sin ceros ni letras que se confundan al dictarse por telefono. */
    private static final String ALFABETO_TOKEN = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    private static final int LARGO_TOKEN = 8;
    private static final SecureRandom AZAR = new SecureRandom();

    private final BranchRepository branchRepository;
    private final BranchDeliverySettingsRepository deliverySettingsRepository;
    private final CustomerRepository customerRepository;
    private final CustomerAddressRepository customerAddressRepository;
    private final ProductRepository productRepository;
    private final OrderRepository orderRepository;
    private final OrderItemRepository orderItemRepository;
    private final InventoryService inventoryService;
    private final AdicionalesService adicionalesService;
    private final FotosService fotosService;
    private final PlanLimitService planLimitService;
    private final OrderService orderService;
    private final WhatsappIntegrationService whatsappIntegrationService;
    private final ColaWhatsapp colaWhatsapp;
    private final SimpMessagingTemplate messagingTemplate;

    /** Desde donde se sirve el sitio del cliente y del repartidor. */
    @org.springframework.beans.factory.annotation.Value("${omnirest.url-publica:http://localhost:4200}")
    private String urlPublica;

    // ------------------------------------------------------------------
    // Menu del enlace publico
    // ------------------------------------------------------------------

    /** Encabezado del menú en línea: restaurante, tiempo de entrega y costo de envío. */
    @Transactional(readOnly = true)
    public com.omnirest.omnirest_backend.dtos.InfoPublicaSucursalDTO infoPublica(UUID branchId) {
        Branch branch = buscarSucursal(branchId);
        BranchDeliverySettings config = deliverySettingsRepository.findById(branchId).orElse(null);
        boolean activa = config != null && Boolean.TRUE.equals(config.getActivo())
                && config.getLatitud() != null && config.getLongitud() != null;
        BigDecimal envioDesde = null;
        if (config != null && config.getTarifaBase() != null) {
            BigDecimal absorbe = config.getPctBaseAbsorbe() != null ? config.getPctBaseAbsorbe() : BigDecimal.ZERO;
            envioDesde = config.getTarifaBase()
                    .multiply(BigDecimal.ONE.subtract(absorbe))
                    .max(BigDecimal.ZERO)
                    .setScale(2, java.math.RoundingMode.HALF_UP);
        }
        return new com.omnirest.omnirest_backend.dtos.InfoPublicaSucursalDTO(
                branch.getRestaurant().getName(),
                branch.getName(),
                branch.getAddress(),
                activa,
                config != null ? config.getMinutosEstimados() : null,
                envioDesde,
                config != null ? config.getKmIncluidos() : null,
                config != null ? config.getPedidoMinimo() : null);
    }

    /**
     * El menu para el carrito web. A diferencia del que consume el bot, este
     * lleva el id de cada platillo: el cliente elige de una lista, no escribe
     * nombres, asi que el pedido llega sin ambiguedad.
     */
    @Transactional(readOnly = true)
    public List<MenuPublicoCategoriaDTO> menuPublico(UUID branchId) {
        Branch branch = buscarSucursal(branchId);
        List<com.omnirest.omnirest_backend.domain.entities.GrupoAdicional> grupos =
                adicionalesService.gruposActivos(branch.getRestaurant().getId());
        java.util.Map<UUID, LocalDateTime> fotos = fotosService.versiones(branch.getRestaurant().getId());

        return productRepository
                .findByCategoryRestaurantIdAndActiveTrue(branch.getRestaurant().getId()).stream()
                .filter(p -> p.getCategory() != null && Boolean.TRUE.equals(p.getCategory().getActive()))
                .collect(Collectors.groupingBy(Product::getCategory, LinkedHashMap::new, Collectors.toList()))
                .entrySet().stream()
                .map(e -> new MenuPublicoCategoriaDTO(
                        e.getKey().getId(),
                        e.getKey().getName(),
                        e.getValue().stream()
                                .sorted(Comparator.comparing(Product::getName, String.CASE_INSENSITIVE_ORDER))
                                .map(p -> new MenuPublicoItemDTO(
                                        p.getId(), p.getName(), p.getPrice(), p.getDescription(),
                                        adicionalesService.gruposDelMenu(p, grupos),
                                        FotosService.url(p.getId(), fotos.get(p.getId()), "mini"),
                                        FotosService.url(p.getId(), fotos.get(p.getId()), "grande")))
                                .toList()))
                .sorted(Comparator.comparing(MenuPublicoCategoriaDTO::nombre, String.CASE_INSENSITIVE_ORDER))
                .toList();
    }

    /**
     * Lo mas pedido de la sucursal en los ultimos 30 dias. Es lo primero que
     * ve el cliente: lo que otros ya eligieron convence mas que una lista.
     */
    @Transactional(readOnly = true)
    public List<UUID> masPedidos(UUID branchId) {
        buscarSucursal(branchId);
        return orderItemRepository.masPedidos(branchId, LocalDateTime.now().minusDays(30), 8);
    }

    // ------------------------------------------------------------------
    // Cotizacion
    // ------------------------------------------------------------------

    /**
     * Cuanto costaria llevar un pedido a ese pin. No crea nada: es lo que el
     * menu web consulta cada vez que el cliente mueve el marcador.
     */
    @Transactional(readOnly = true)
    public CotizacionEnvioResponseDTO cotizar(UUID branchId, BigDecimal latitud, BigDecimal longitud) {
        Branch branch = buscarSucursal(branchId);

        if (!planLimitService.hasDelivery(branch.getRestaurant().getId())) {
            return noDisponible("Esta sucursal no tiene servicio a domicilio.");
        }

        BranchDeliverySettings config = deliverySettingsRepository.findById(branchId).orElse(null);
        if (config == null || !config.listoParaRepartir()) {
            return noDisponible("El servicio a domicilio no esta disponible por ahora.");
        }

        BigDecimal distancia = Distancia.porCalles(
                config.getLatitud(), config.getLongitud(), latitud, longitud, config.getFactorCalles());

        CalculadoraEnvio.Envio envio = CalculadoraEnvio.calcular(distancia, tarifaDe(config));

        if (envio.fueraDeCobertura()) {
            return new CotizacionEnvioResponseDTO(true, true, envio.distanciaKm(),
                    null, null, null, config.getPedidoMinimo(), null,
                    "Tu direccion queda a " + envio.distanciaKm() + " km y repartimos hasta "
                            + config.getDistanciaMaximaKm() + " km.");
        }

        return new CotizacionEnvioResponseDTO(true, false,
                envio.distanciaKm(), envio.costoTotal(), envio.absorbeRestaurante(), envio.pagaCliente(),
                config.getPedidoMinimo(), config.getMinutosEstimados(), null);
    }

    // ------------------------------------------------------------------
    // Creacion del pedido
    // ------------------------------------------------------------------

    @Transactional
    public PedidoDomicilioResponseDTO crearPedido(UUID branchId, CrearPedidoDomicilioRequestDTO request) {
        Branch branch = buscarSucursal(branchId);
        UUID restaurantId = branch.getRestaurant().getId();

        planLimitService.checkDeliveryAvailable(restaurantId);

        BranchDeliverySettings config = deliverySettingsRepository.findById(branchId)
                .filter(BranchDeliverySettings::listoParaRepartir)
                .orElseThrow(() -> new IllegalStateException(
                        "El servicio a domicilio no esta disponible por ahora."));

        // 1. El envio se cotiza aqui de nuevo, no se confia en lo que mande el
        // navegador: entre la cotizacion y el pedido pudo cambiar la tarifa.
        BigDecimal distancia = Distancia.porCalles(
                config.getLatitud(), config.getLongitud(),
                request.latitud(), request.longitud(), config.getFactorCalles());
        CalculadoraEnvio.Envio envio = CalculadoraEnvio.calcular(distancia, tarifaDe(config));

        if (envio.fueraDeCobertura()) {
            throw new IllegalArgumentException("Tu direccion queda fuera de nuestra zona de reparto ("
                    + envio.distanciaKm() + " km, repartimos hasta " + config.getDistanciaMaximaKm() + " km).");
        }

        // 2. Los platillos, validando que sean de este restaurante y esten activos.
        Customer customer = buscarOCrearCliente(branch, request.phoneNumber(), request.nombre());

        Order order = Order.builder()
                .branch(branch)
                .table(null)
                .customer(customer)
                .status(OrderStatus.OPEN)
                .orderType(OrderType.DOMICILIO)
                .deliveryStatus(DeliveryStatus.NUEVO)
                .totalAmount(BigDecimal.ZERO)
                .direccionEntrega(request.direccion())
                .referenciasEntrega(request.referencias())
                .latitudEntrega(request.latitud())
                .longitudEntrega(request.longitud())
                .notasEntrega(request.notas())
                .distanciaKm(envio.distanciaKm())
                .envioTotal(envio.costoTotal())
                .envioAbsorbido(envio.absorbeRestaurante())
                .envioCobrado(envio.pagaCliente())
                .pagaCon(request.pagaCon())
                .propina(request.propina())
                .minutosEstimados(config.getMinutosEstimados())
                .tokenSeguimiento(nuevoToken())
                .origen("WEB")
                .build();
        order = orderRepository.save(order);

        List<OrderItem> items = new ArrayList<>();
        BigDecimal subtotal = armarPlatillos(order, request.items(), restaurantId, branchId, items);

        // 3. El pedido minimo se mide sobre la comida, sin contar el envio: de
        // otro modo un envio caro haria pasar un pedido chico.
        if (config.getPedidoMinimo() != null && subtotal.compareTo(config.getPedidoMinimo()) < 0) {
            throw new IllegalStateException("El pedido minimo a domicilio es de $" + config.getPedidoMinimo()
                    + " y tu pedido suma $" + subtotal + ".");
        }

        orderItemRepository.saveAll(items);

        // totalAmount guarda SOLO la comida, igual que en salon: la cuenta se
        // recalcula desde los platillos en varios lugares y sumarle el envio
        // aqui lo borraria en el primer recalculo. El envio vive en sus propias
        // columnas.
        order.setTotalAmount(subtotal);
        order = orderRepository.save(order);

        if (Boolean.TRUE.equals(request.guardarDireccion())) {
            guardarDireccion(customer, request);
        }

        // El pedido nace en NUEVO, asi que todavia no va a cocina: quien tiene
        // que verlo aparecer es el mostrador, para aceptarlo.
        publicarTablero(branchId);

        BigDecimal envioCobrado = envio.pagaCliente();
        BigDecimal propina = request.propina() != null ? request.propina() : BigDecimal.ZERO;
        BigDecimal total = subtotal.add(envioCobrado).add(propina);

        log.info("Pedido a domicilio {} creado en sucursal {}: {} km, comida ${}, envio ${}",
                order.getTokenSeguimiento(), branchId, envio.distanciaKm(), subtotal, envioCobrado);

        return new PedidoDomicilioResponseDTO(
                order.getId(),
                order.getTokenSeguimiento(),
                order.getDeliveryStatus(),
                subtotal,
                envioCobrado,
                total,
                envio.distanciaKm(),
                order.getMinutosEstimados(),
                cambio(request.pagaCon(), total));
    }

    /**
     * Arma las lineas del pedido validando cada platillo: que sea de este
     * restaurante, que este activo, que haya inventario y que sus adicionales
     * sean validos. Devuelve el subtotal de la comida.
     */
    private BigDecimal armarPlatillos(Order order, List<PedidoDomicilioItemDTO> lineas, UUID restaurantId,
                                      UUID branchId, List<OrderItem> items) {
        List<com.omnirest.omnirest_backend.domain.entities.GrupoAdicional> grupos =
                adicionalesService.gruposActivos(restaurantId);

        BigDecimal subtotal = BigDecimal.ZERO;
        for (PedidoDomicilioItemDTO linea : lineas) {
            Product product = productRepository.findById(linea.productId())
                    .orElseThrow(() -> new IllegalArgumentException("Producto no encontrado."));

            if (product.getCategory() == null || product.getCategory().getRestaurant() == null
                    || !product.getCategory().getRestaurant().getId().equals(restaurantId)) {
                throw new IllegalArgumentException("El producto " + product.getName()
                        + " no pertenece a este restaurante.");
            }
            if (product.getActive() != null && !product.getActive()) {
                throw new IllegalStateException("El producto " + product.getName()
                        + " no esta disponible en este momento.");
            }

            inventoryService.checkAndDeductStock(product, branchId, linea.quantity());

            // El precio unitario ya lleva los adicionales: asi la cuenta, que se
            // recalcula como cantidad x precio unitario, no los pierde.
            OrderItem item = OrderItem.builder()
                    .order(order)
                    .product(product)
                    .quantity(linea.quantity())
                    .unitPrice(product.getPrice())
                    .specialInstructions(linea.specialInstructions())
                    .build();
            adicionalesService.aplicarALinea(item,
                    adicionalesService.resolver(product, linea.adicionales(), grupos));
            inventoryService.descontarAdicionales(item, branchId);

            subtotal = subtotal.add(item.getUnitPrice().multiply(BigDecimal.valueOf(linea.quantity())));
            items.add(item);
        }
        return subtotal;
    }

    // ------------------------------------------------------------------
    // Pedido por telefono
    // ------------------------------------------------------------------

    /**
     * Quien llama, si ya ha pedido antes: nombre y direcciones guardadas.
     * Solo para el panel; al publico nunca se le dice si un numero es cliente.
     */
    @Transactional(readOnly = true)
    public com.omnirest.omnirest_backend.dtos.ClienteTelefonoDTO buscarCliente(UUID branchId, String telefonoCrudo) {
        Branch branch = buscarSucursal(branchId);
        String telefono = TelefonoMx.canonico(telefonoCrudo);
        return customerRepository.findByRestaurantIdAndPhoneNumber(branch.getRestaurant().getId(), telefono)
                .map(c -> new com.omnirest.omnirest_backend.dtos.ClienteTelefonoDTO(
                        true, c.getPhoneNumber(), c.getName(), c.getTotalVisits(), c.getLastVisit(),
                        customerAddressRepository.findByCustomerIdAndActivaTrueOrderByEsPrincipalDescCreadaEnDesc(c.getId())
                                .stream()
                                .map(a -> new com.omnirest.omnirest_backend.dtos.ClienteTelefonoDTO.Direccion(
                                        a.getId(), a.getAlias(), a.getDireccion(), a.getReferencias(),
                                        a.getLatitud(), a.getLongitud()))
                                .toList()))
                .orElse(new com.omnirest.omnirest_backend.dtos.ClienteTelefonoDTO(
                        false, telefono, null, 0, null, List.of()));
    }

    /**
     * El pedido que captura el encargado mientras habla con el cliente. Nace
     * confirmado, porque ya se acordo por telefono, y entra directo a cocina.
     */
    @Transactional
    public PedidoDomicilioResponseDTO crearPedidoTelefonico(UUID branchId,
                                                           com.omnirest.omnirest_backend.dtos.PedidoTelefonicoDTO p) {
        if (p.tipo() != OrderType.DOMICILIO && p.tipo() != OrderType.PARA_LLEVAR) {
            throw new IllegalArgumentException("Un pedido por teléfono es a domicilio o para llevar.");
        }

        PedidoDomicilioResponseDTO creado;
        if (p.tipo() == OrderType.DOMICILIO) {
            if (p.direccion() == null || p.direccion().isBlank()) {
                throw new IllegalArgumentException("Falta la dirección de entrega.");
            }
            if (p.latitud() == null || p.longitud() == null) {
                throw new IllegalArgumentException(
                        "Falta la ubicación: pide al cliente que te mande su ubicación por WhatsApp y pega el enlace.");
            }
            // Mismas reglas que el menu web: cobertura, tarifa y pedido minimo.
            creado = crearPedido(branchId, new CrearPedidoDomicilioRequestDTO(
                    p.phoneNumber(), p.nombre(), p.direccion().trim(), p.referencias(),
                    p.latitud(), p.longitud(), p.notas(), p.guardarDireccion(), p.aliasDireccion(),
                    p.items(), p.pagaCon(), null));
        } else {
            creado = crearParaLlevar(branchId, p);
        }

        Order order = orderRepository.findById(creado.orderId()).orElseThrow();
        order.setOrigen("TELEFONO");
        orderRepository.save(order);

        // Confirmar pasa por el mismo camino que el boton del tablero: entra a
        // cocina, se publica el tablero y el cliente recibe su confirmacion.
        cambiarEstado(branchId, order.getId(),
                new CambiarEstadoEntregaDTO(DeliveryStatus.CONFIRMADO, null));

        log.info("Pedido telefonico {} ({}) creado en sucursal {}", creado.tokenSeguimiento(), p.tipo(), branchId);
        return new PedidoDomicilioResponseDTO(creado.orderId(), creado.tokenSeguimiento(), DeliveryStatus.CONFIRMADO,
                creado.subtotal(), creado.envioCobrado(), creado.total(), creado.distanciaKm(),
                creado.minutosEstimados(), creado.cambioSugerido());
    }

    /** Para llevar: sin direccion, sin envio y sin repartidor. */
    private PedidoDomicilioResponseDTO crearParaLlevar(UUID branchId, com.omnirest.omnirest_backend.dtos.PedidoTelefonicoDTO p) {
        Branch branch = buscarSucursal(branchId);
        UUID restaurantId = branch.getRestaurant().getId();
        planLimitService.checkDeliveryAvailable(restaurantId);

        BranchDeliverySettings config = deliverySettingsRepository.findById(branchId).orElse(null);
        Customer customer = buscarOCrearCliente(branch, p.phoneNumber(), p.nombre());

        Order order = orderRepository.save(Order.builder()
                .branch(branch)
                .table(null)
                .customer(customer)
                .status(OrderStatus.OPEN)
                .orderType(OrderType.PARA_LLEVAR)
                .deliveryStatus(DeliveryStatus.NUEVO)
                .totalAmount(BigDecimal.ZERO)
                .notasEntrega(p.notas())
                .envioCobrado(BigDecimal.ZERO)
                .pagaCon(p.pagaCon())
                .minutosEstimados(config != null ? config.getMinutosEstimados() : null)
                .tokenSeguimiento(nuevoToken())
                .build());

        List<OrderItem> items = new ArrayList<>();
        BigDecimal subtotal = armarPlatillos(order, p.items(), restaurantId, branchId, items);
        orderItemRepository.saveAll(items);
        order.setTotalAmount(subtotal);
        orderRepository.save(order);

        return new PedidoDomicilioResponseDTO(order.getId(), order.getTokenSeguimiento(), order.getDeliveryStatus(),
                subtotal, BigDecimal.ZERO, subtotal, null, order.getMinutosEstimados(), cambio(p.pagaCon(), subtotal));
    }

    // ------------------------------------------------------------------
    // Tablero de reparto
    // ------------------------------------------------------------------

    /**
     * Los pedidos a domicilio de la sucursal. Por omision solo los vivos; con
     * {@code soloActivos = false} tambien los ya entregados y cancelados, para
     * revisar el dia.
     */
    @Transactional(readOnly = true)
    public List<PedidoDomicilioPanelDTO> listarPedidos(UUID branchId, boolean soloActivos, LocalDateTime desde) {
        buscarSucursal(branchId);
        List<Order> pedidos = desde != null
                ? orderRepository.findDeliveryOrdersDesde(branchId, soloActivos, desde)
                : orderRepository.findDeliveryOrders(branchId, soloActivos);
        return pedidos.stream().map(this::aPanel).toList();
    }

    /**
     * Mueve el pedido en el tablero: aceptarlo, marcarlo listo, en camino,
     * entregado o cancelarlo.
     */
    @Transactional
    public PedidoDomicilioPanelDTO cambiarEstado(UUID branchId, UUID orderId, CambiarEstadoEntregaDTO peticion) {
        Order order = orderRepository.findByIdAndBranchId(orderId, branchId)
                .orElseThrow(() -> new IllegalArgumentException("Pedido no encontrado en esta sucursal."));

        if (order.getOrderType() == OrderType.SALON) {
            throw new IllegalArgumentException("Este pedido es de salon, no de reparto.");
        }

        BranchDeliverySettings config = deliverySettingsRepository.findById(branchId).orElse(null);

        DeliveryStatus actual = order.getDeliveryStatus() != null ? order.getDeliveryStatus() : DeliveryStatus.NUEVO;
        DeliveryStatus nuevo = peticion.estado();

        if (!actual.puedeAvanzarA(nuevo)) {
            throw new IllegalStateException(actual.esFinal()
                    ? "El pedido ya esta " + actual + " y no admite mas cambios."
                    : "No se puede pasar de " + actual + " a " + nuevo + ".");
        }

        // Para llevar no tiene repartidor: de listo pasa a entregado en mostrador.
        if (order.getOrderType() == OrderType.PARA_LLEVAR && nuevo == DeliveryStatus.EN_CAMINO) {
            throw new IllegalStateException("Un pedido para llevar no sale a reparto: márcalo entregado cuando lo recojan.");
        }

        // Empacar es lo que hace el mostrador cuando cocina ya solto la comida.
        // Marcarlo antes dejaria salir al repartidor con las manos vacias.
        if (nuevo == DeliveryStatus.LISTO) {
            KitchenStatus cocina = KitchenSummary.resumir(orderItemRepository.findByOrderId(order.getId()));
            if (cocina == KitchenStatus.PENDING || cocina == KitchenStatus.PREPARING) {
                throw new IllegalStateException(
                        "La cocina todavía no libera este pedido. Espera a que los platillos estén listos.");
            }
        }

        order.setDeliveryStatus(nuevo);

        switch (nuevo) {
            case EN_CAMINO -> order.setRecogidoEn(LocalDateTime.now());
            case ENTREGADO -> {
                order.setEntregadoEn(LocalDateTime.now());
                // Entregado y cobrado: la cuenta se cierra sola, no hay mesa que
                // liberar ni mesero que pase a cobrar.
                order.setStatus(OrderStatus.CLOSED);
                order.setClosedAt(LocalDateTime.now());
            }
            case CANCELADO -> cancelarPedido(order);
            default -> {
                // CONFIRMADO y LISTO no cambian nada mas del pedido.
            }
        }

        orderRepository.save(order);

        // Empacado: si nadie lo ha tomado se ofrece en el grupo; si ya tiene
        // dueno se le avisa a el directo, que es quien esta esperando. Sin este
        // aviso el repartidor no tiene como enterarse mas que preguntando.
        if (nuevo == DeliveryStatus.LISTO && order.getOrderType() == OrderType.DOMICILIO) {
            if (order.getDriver() == null) {
                publicarEnGrupoDeRepartidores(order, config);
            } else {
                avisarAlRepartidor(order,
                        "📦 *Tu entrega ya está empacada* — " + order.getTokenSeguimiento(),
                        "Pásala a recoger cuando puedas.");
            }
        }

        // Cancelar con repartidor asignado: hay que alcanzarlo antes de que
        // vaya por un pedido que ya no existe.
        if (nuevo == DeliveryStatus.CANCELADO && order.getDriver() != null) {
            avisarAlRepartidor(order,
                    "❌ *Entrega cancelada* — " + order.getTokenSeguimiento(),
                    peticion.motivo() != null && !peticion.motivo().isBlank()
                            ? "Motivo: " + peticion.motivo()
                            : "El restaurante la dio de baja.");
        }

        // Los tres momentos en que el pedido entra o sale del tablero de
        // cocina: al aceptarlo aparece, y al entregarlo o cancelarlo se va.
        // Sin este aviso la comanda se quedaba a la vista hasta que alguien
        // recargara la pantalla.
        if (nuevo == DeliveryStatus.CONFIRMADO
                || nuevo == DeliveryStatus.CANCELADO
                || nuevo == DeliveryStatus.ENTREGADO) {
            messagingTemplate.convertAndSend("/topic/branches/" + branchId + "/kitchen",
                    orderService.getKitchenTickets(branchId));
        }
        publicarTablero(branchId);
        avisarAlCliente(order, nuevo, peticion.motivo());

        log.info("Pedido a domicilio {} paso de {} a {}", order.getTokenSeguimiento(), actual, nuevo);
        return aPanel(order);
    }

    /**
     * Cancelar devuelve el inventario y marca los platillos, igual que cuando
     * se cancela un platillo en cocina: lo que no se sirvio no se descuenta.
     */
    private void cancelarPedido(Order order) {
        for (OrderItem item : orderItemRepository.findByOrderId(order.getId())) {
            if (item.getKitchenStatus() == KitchenStatus.CANCELLED) {
                continue;
            }
            if (item.getProduct() != null && item.getQuantity() != null) {
                inventoryService.restoreStock(item.getProduct(), order.getBranch().getId(), item.getQuantity());
            }
            inventoryService.devolverAdicionales(item, order.getBranch().getId());
            item.setKitchenStatus(KitchenStatus.CANCELLED);
            orderItemRepository.save(item);
        }
        order.setStatus(OrderStatus.CANCELLED);
        order.setClosedAt(LocalDateTime.now());
        order.setTotalAmount(BigDecimal.ZERO);
    }

    /**
     * Ofrece la entrega en el grupo de WhatsApp de los repartidores. El mensaje
     * lleva el enlace con el que quien la tome se identifica: por eso despues
     * se sabe quien llevo cada pedido.
     *
     * Si la sucursal no tiene grupo configurado no pasa nada: el mostrador
     * seguira asignando a mano desde el tablero.
     */
    private void publicarEnGrupoDeRepartidores(Order order, BranchDeliverySettings config) {
        if (!hayGrupo(config)) {
            return;
        }
        // Por la cola: si WhatsApp esta caido se reintenta solo. El mostrador
        // igual puede publicarlo a mano.
        colaWhatsapp.encolar(order.getBranch().getId(), config.getGrupoRepartidores().trim(),
                mensajeParaGrupo(order, config), com.omnirest.omnirest_backend.domain.entities.MensajeWhatsapp.Motivo.GRUPO_REPARTIDORES, "grupo:" + order.getId());
    }

    /**
     * Publica la entrega en el grupo a peticion del mostrador. A diferencia del
     * envio automatico, este espera la respuesta: quien aprieta el boton tiene
     * que saber si salio o no.
     */
    @Transactional
    public String publicarAhora(UUID branchId, UUID orderId) {
        Order order = orderRepository.findByIdAndBranchId(orderId, branchId)
                .orElseThrow(() -> new IllegalArgumentException("Pedido no encontrado en esta sucursal."));

        if (order.getOrderType() == OrderType.SALON) {
            throw new IllegalArgumentException("Este pedido es de salon, no de reparto.");
        }
        if (order.getDeliveryStatus() != null && order.getDeliveryStatus().esFinal()) {
            throw new IllegalStateException("Este pedido ya está cerrado.");
        }
        if (order.getDriver() != null) {
            throw new IllegalStateException(
                    "Esta entrega ya la tomó " + order.getDriver().getNombre() + ".");
        }

        BranchDeliverySettings config = deliverySettingsRepository.findById(branchId).orElse(null);
        if (!hayGrupo(config)) {
            throw new IllegalStateException(
                    "Esta sucursal no tiene grupo de repartidores. Elígelo en Sucursales.");
        }

        try {
            whatsappIntegrationService.sendMessage(
                    branchId.toString(), config.getGrupoRepartidores().trim(), mensajeParaGrupo(order, config));
        } catch (Exception e) {
            log.error("Fallo al publicar a mano la entrega {}: {}", order.getTokenSeguimiento(), e.getMessage(), e);
            throw new IllegalStateException(
                    "No se pudo enviar al grupo. Revisa que el WhatsApp de la sucursal esté conectado.");
        }

        log.info("Entrega {} publicada a mano en el grupo", order.getTokenSeguimiento());
        return "Entrega " + order.getTokenSeguimiento() + " publicada en el grupo.";
    }

    /**
     * Le escribe por WhatsApp al repartidor que tiene la entrega asignada. Va
     * en segundo plano: si WhatsApp esta caido, el pedido igual avanza en el
     * tablero y el repartidor todavia puede ver el cambio en su pantalla.
     */
    private void avisarAlRepartidor(Order order, String titulo, String detalle) {
        Driver repartidor = order.getDriver();
        if (repartidor == null || repartidor.getPhoneNumber() == null
                || repartidor.getPhoneNumber().isBlank()) {
            return;
        }

        final String enlace = urlPublica.replaceAll("/+$", "") + "/repartidor/" + order.getTokenSeguimiento();
        final String mensaje = String.join("\n", List.of(
                titulo,
                "",
                "📍 " + (order.getDireccionEntrega() != null ? order.getDireccionEntrega() : "Sin dirección"),
                detalle,
                "",
                "👉 " + enlace));

        colaWhatsapp.encolar(order.getBranch().getId(), repartidor.getPhoneNumber(), mensaje,
                com.omnirest.omnirest_backend.domain.entities.MensajeWhatsapp.Motivo.AVISO_REPARTIDOR, null);
    }

    private boolean hayGrupo(BranchDeliverySettings config) {
        return config != null
                && config.getGrupoRepartidores() != null
                && !config.getGrupoRepartidores().isBlank();
    }

    /** El texto que ven los repartidores en el grupo. */
    private String mensajeParaGrupo(Order order, BranchDeliverySettings config) {
        final String enlace = urlPublica.replaceAll("/+$", "") + "/repartidor/" + order.getTokenSeguimiento();

        BigDecimal aCobrar = (order.getTotalAmount() != null ? order.getTotalAmount() : BigDecimal.ZERO)
                .add(order.getEnvioCobrado() != null ? order.getEnvioCobrado() : BigDecimal.ZERO);

        // Se arma como lista de renglones y se une al final: asi el mensaje se
        // lee aqui igual que como llega al grupo.
        List<String> renglones = new ArrayList<>();
        renglones.add("🛵 *Entrega disponible* — " + order.getTokenSeguimiento());
        renglones.add("");
        renglones.add("📍 " + (order.getDireccionEntrega() != null ? order.getDireccionEntrega() : "Sin dirección"));
        if (order.getReferenciasEntrega() != null && !order.getReferenciasEntrega().isBlank()) {
            renglones.add("_" + order.getReferenciasEntrega() + "_");
        }
        if (order.getDistanciaKm() != null) {
            renglones.add("🛣️ " + order.getDistanciaKm() + " km");
        }
        renglones.add("💵 Cobrar $" + aCobrar);
        if (config.getPagoRepartidorFijo() != null) {
            renglones.add("🤝 Te pagamos desde $" + config.getPagoRepartidorFijo());
        }
        renglones.add("");
        renglones.add("👉 " + enlace);
        renglones.add("_El primero que la tome se la lleva._");

        return String.join("\n", renglones);
    }

    /** Refresca el tablero del mostrador desde otro servicio. */
    @Transactional(readOnly = true)
    /** Cocina (u otro modulo) cambio un pedido a domicilio. */
    @org.springframework.context.event.EventListener
    public void alCambiarPedido(PedidoDomicilioCambio cambio) {
        publicarTablero(cambio.branchId());
    }

    public void publicarTableroDe(UUID branchId) {
        publicarTablero(branchId);
    }

    /** Empuja el tablero a quien lo tenga abierto, para que no haya que recargar. */
    private void publicarTablero(UUID branchId) {
        messagingTemplate.convertAndSend("/topic/branches/" + branchId + "/delivery",
                listarPedidos(branchId, true, null));
    }

    /**
     * Le avisa al cliente por WhatsApp. Se manda aparte del hilo del pedido: si
     * WhatsApp esta caido, el pedido igual avanza en el tablero.
     */
    private void avisarAlCliente(Order order, DeliveryStatus estado, String motivo) {
        if (order.getCustomer() == null || order.getCustomer().getPhoneNumber() == null
                || order.getCustomer().getPhoneNumber().isBlank()) {
            return;
        }

        final String texto;
        switch (estado) {
            case CONFIRMADO -> texto = "✅ Confirmamos tu pedido " + order.getTokenSeguimiento() + "."
                    + (order.getMinutosEstimados() != null
                            ? " Calculamos unos " + order.getMinutosEstimados() + " minutos."
                            : "");
            case EN_CAMINO -> texto = "🛵 Tu pedido " + order.getTokenSeguimiento() + " ya va en camino.";
            // Para llevar, "listo" es justo lo que el cliente espera oir.
            case LISTO -> {
                if (order.getOrderType() != OrderType.PARA_LLEVAR) return;
                texto = "🛍️ Tu pedido " + order.getTokenSeguimiento() + " ya está listo. ¡Pasa por él cuando quieras!";
            }
            case ENTREGADO -> {
                // Para llevar lo recoge en persona: no hace falta avisarle.
                if (order.getOrderType() == OrderType.PARA_LLEVAR) return;
                texto = "📦 Tu pedido fue entregado. ¡Buen provecho!";
            }
            case CANCELADO -> texto = "❌ Tu pedido " + order.getTokenSeguimiento() + " fue cancelado."
                    + (motivo != null && !motivo.isBlank() ? " Motivo: " + motivo : "");
            // LISTO es un paso interno del mostrador: al cliente no le dice nada
            // util saber que su comida esta empacada esperando repartidor.
            default -> {
                return;
            }
        }

        // Misma clave para todos los estados del pedido: si WhatsApp estuvo caido
        // mientras avanzaba, al volver solo sale el ultimo, no tres seguidos.
        colaWhatsapp.encolar(order.getBranch().getId(), order.getCustomer().getPhoneNumber(), texto,
                estado == DeliveryStatus.CANCELADO ? com.omnirest.omnirest_backend.domain.entities.MensajeWhatsapp.Motivo.CANCELACION : com.omnirest.omnirest_backend.domain.entities.MensajeWhatsapp.Motivo.ESTADO_PEDIDO,
                "estado:" + order.getId());
    }

    private PedidoDomicilioPanelDTO aPanel(Order order) {
        List<OrderItem> items = order.getOrderItems() != null
                ? order.getOrderItems()
                : orderItemRepository.findByOrderId(order.getId());

        List<OrderItem> vivos = items.stream()
                .filter(i -> i.getKitchenStatus() != KitchenStatus.CANCELLED)
                .toList();

        BigDecimal subtotal = vivos.stream()
                .filter(i -> i.getUnitPrice() != null)
                .map(i -> i.getUnitPrice().multiply(BigDecimal.valueOf(i.getQuantity() != null ? i.getQuantity() : 1)))
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal envioCobrado = order.getEnvioCobrado() != null ? order.getEnvioCobrado() : BigDecimal.ZERO;
        BigDecimal propina = order.getPropina() != null ? order.getPropina() : BigDecimal.ZERO;
        BigDecimal total = subtotal.add(envioCobrado).add(propina);

        return new PedidoDomicilioPanelDTO(
                order.getId(),
                order.getTokenSeguimiento(),
                order.getOrderType(),
                order.getDeliveryStatus(),
                KitchenSummary.resumir(vivos),
                order.getCreatedAt(),
                order.getMinutosEstimados(),
                order.getCustomer() != null ? order.getCustomer().getName() : null,
                order.getCustomer() != null ? order.getCustomer().getPhoneNumber() : null,
                order.getDireccionEntrega(),
                order.getReferenciasEntrega(),
                order.getNotasEntrega(),
                order.getLatitudEntrega(),
                order.getLongitudEntrega(),
                order.getDistanciaKm(),
                subtotal,
                order.getEnvioTotal(),
                order.getEnvioAbsorbido(),
                envioCobrado,
                propina,
                total,
                order.getPagaCon(),
                cambio(order.getPagaCon(), total),
                vivos.stream()
                        .map(i -> new KitchenTicketItemDTO(
                                i.getId(),
                                i.getProduct() != null ? i.getProduct().getName() : "Producto",
                                i.getQuantity(),
                                i.getSpecialInstructions(),
                                i.getKitchenStatus(),
                                i.adicionalesParaMostrar()))
                        .toList(),
                order.getDriver() != null ? order.getDriver().getNombre() : null,
                order.getDriver() != null ? order.getDriver().getPhoneNumber() : null,
                order.getPagoRepartidor(),
                order.getRecogidoEn(),
                order.getEntregadoEn(),
                order.getOrigen());
    }

    // ------------------------------------------------------------------
    // Configuracion de la sucursal
    // ------------------------------------------------------------------

    /** Devuelve la configuracion, o los valores por defecto si aun no existe. */
    @Transactional(readOnly = true)
    public DeliverySettingsDTO obtenerConfiguracion(UUID branchId) {
        buscarSucursal(branchId);
        return aDto(deliverySettingsRepository.findById(branchId)
                .orElseGet(BranchDeliverySettings::new));
    }

    @Transactional
    public DeliverySettingsDTO guardarConfiguracion(UUID branchId, DeliverySettingsDTO dto) {
        Branch branch = buscarSucursal(branchId);
        planLimitService.checkDeliveryAvailable(branch.getRestaurant().getId());

        BranchDeliverySettings config = deliverySettingsRepository.findById(branchId)
                .orElseGet(() -> BranchDeliverySettings.builder().branch(branch).build());

        // Solo se pisa lo que venga: un campo ausente conserva su valor.
        if (dto.activo() != null) config.setActivo(dto.activo());
        if (dto.latitud() != null) config.setLatitud(dto.latitud());
        if (dto.longitud() != null) config.setLongitud(dto.longitud());
        if (dto.kmIncluidos() != null) config.setKmIncluidos(dto.kmIncluidos());
        if (dto.tarifaBase() != null) config.setTarifaBase(dto.tarifaBase());
        if (dto.pctBaseAbsorbe() != null) config.setPctBaseAbsorbe(dto.pctBaseAbsorbe());
        if (dto.precioKmExtra() != null) config.setPrecioKmExtra(dto.precioKmExtra());
        if (dto.pctExtraAbsorbe() != null) config.setPctExtraAbsorbe(dto.pctExtraAbsorbe());
        if (dto.redondeoKm() != null) config.setRedondeoKm(dto.redondeoKm());
        if (dto.distanciaMaximaKm() != null) config.setDistanciaMaximaKm(dto.distanciaMaximaKm());
        if (dto.factorCalles() != null) config.setFactorCalles(dto.factorCalles());
        if (dto.pedidoMinimo() != null) config.setPedidoMinimo(dto.pedidoMinimo());
        if (dto.minutosEstimados() != null) config.setMinutosEstimados(dto.minutosEstimados());
        if (dto.grupoRepartidores() != null) config.setGrupoRepartidores(dto.grupoRepartidores());
        if (dto.pagoRepartidorFijo() != null) config.setPagoRepartidorFijo(dto.pagoRepartidorFijo());
        if (dto.pagoRepartidorKm() != null) config.setPagoRepartidorKm(dto.pagoRepartidorKm());

        // Prender el delivery sin decir de donde sale el repartidor dejaria
        // cotizaciones imposibles de calcular.
        if (Boolean.TRUE.equals(config.getActivo())
                && (config.getLatitud() == null || config.getLongitud() == null)) {
            throw new IllegalArgumentException(
                    "Marca la ubicacion de la sucursal en el mapa antes de activar el servicio a domicilio.");
        }

        config.setActualizadoEn(LocalDateTime.now());
        return aDto(deliverySettingsRepository.save(config));
    }

    private DeliverySettingsDTO aDto(BranchDeliverySettings c) {
        return new DeliverySettingsDTO(
                c.getActivo(), c.getLatitud(), c.getLongitud(),
                c.getKmIncluidos(), c.getTarifaBase(), c.getPctBaseAbsorbe(),
                c.getPrecioKmExtra(), c.getPctExtraAbsorbe(),
                c.getRedondeoKm(), c.getDistanciaMaximaKm(), c.getFactorCalles(),
                c.getPedidoMinimo(), c.getMinutosEstimados(), c.getGrupoRepartidores(),
                c.getPagoRepartidorFijo(), c.getPagoRepartidorKm());
    }

    // ------------------------------------------------------------------
    // Apoyos
    // ------------------------------------------------------------------

    private CalculadoraEnvio.Tarifa tarifaDe(BranchDeliverySettings c) {
        return new CalculadoraEnvio.Tarifa(
                c.getKmIncluidos(), c.getTarifaBase(), c.getPctBaseAbsorbe(),
                c.getPrecioKmExtra(), c.getPctExtraAbsorbe(),
                c.getRedondeoKm(), c.getDistanciaMaximaKm());
    }

    private CotizacionEnvioResponseDTO noDisponible(String mensaje) {
        return new CotizacionEnvioResponseDTO(false, false, null, null, null, null, null, null, mensaje);
    }

    private Branch buscarSucursal(UUID branchId) {
        return branchRepository.findById(branchId)
                .orElseThrow(() -> new IllegalArgumentException("Sucursal no encontrada."));
    }

    /**
     * El cliente se identifica por telefono dentro del restaurante. Si ya pidio
     * antes se reusa su ficha; si escribio un nombre, se actualiza.
     */
    private Customer buscarOCrearCliente(Branch branch, String phoneNumber, String nombre) {
        // Mismo numero que ya uso por WhatsApp: se reusa su ficha en vez de
        // abrirle otra por haber pedido desde el menu web.
        final String telefono = TelefonoMx.canonico(phoneNumber);

        Customer customer = customerRepository
                .findByRestaurantIdAndPhoneNumber(branch.getRestaurant().getId(), telefono)
                .orElseGet(() -> Customer.builder()
                        .restaurant(branch.getRestaurant())
                        .phoneNumber(telefono)
                        .name("Cliente")
                        .build());

        if (nombre != null && !nombre.isBlank()) {
            customer.setName(nombre.trim());
        }
        return customerRepository.save(customer);
    }

    private void guardarDireccion(Customer customer, CrearPedidoDomicilioRequestDTO request) {
        customerAddressRepository.save(CustomerAddress.builder()
                .customer(customer)
                .alias(request.aliasDireccion())
                .direccion(request.direccion())
                .referencias(request.referencias())
                .latitud(request.latitud())
                .longitud(request.longitud())
                .build());
    }

    /** Cuanto cambio hay que llevarle. Null si no dijo con cuanto paga. */
    private BigDecimal cambio(BigDecimal pagaCon, BigDecimal total) {
        if (pagaCon == null || pagaCon.compareTo(total) <= 0) {
            return null;
        }
        return pagaCon.subtract(total);
    }

    private String nuevoToken() {
        StringBuilder sb = new StringBuilder(LARGO_TOKEN);
        for (int i = 0; i < LARGO_TOKEN; i++) {
            sb.append(ALFABETO_TOKEN.charAt(AZAR.nextInt(ALFABETO_TOKEN.length())));
        }
        return sb.toString();
    }
}
