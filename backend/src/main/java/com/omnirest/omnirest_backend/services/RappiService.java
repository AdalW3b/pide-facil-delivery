package com.omnirest.omnirest_backend.services;

import com.omnirest.omnirest_backend.domain.entities.Branch;
import com.omnirest.omnirest_backend.domain.entities.GrupoAdicional;
import com.omnirest.omnirest_backend.domain.entities.Order;
import com.omnirest.omnirest_backend.domain.entities.OrderItem;
import com.omnirest.omnirest_backend.domain.entities.PedidoRappi;
import com.omnirest.omnirest_backend.domain.entities.Product;
import com.omnirest.omnirest_backend.domain.entities.RappiTienda;
import com.omnirest.omnirest_backend.domain.enums.DeliveryStatus;
import com.omnirest.omnirest_backend.domain.enums.OrderStatus;
import com.omnirest.omnirest_backend.domain.enums.OrderType;
import com.omnirest.omnirest_backend.dtos.CambiarEstadoEntregaDTO;
import com.omnirest.omnirest_backend.repositories.BranchRepository;
import com.omnirest.omnirest_backend.repositories.OrderItemRepository;
import com.omnirest.omnirest_backend.repositories.OrderRepository;
import com.omnirest.omnirest_backend.repositories.PedidoRappiRepository;
import com.omnirest.omnirest_backend.repositories.ProductRepository;
import com.omnirest.omnirest_backend.repositories.RappiTiendaRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Pedidos que llegan de Rappi por webhook.
 *
 * Un pedido de Rappi entra al tablero de Domicilio como uno mas: nace en NUEVO
 * para que el mostrador lo acepte o lo rechace. Lo que cambia es que ya esta
 * cobrado, asi que nunca se rechaza aqui al recibirlo: lo que no se reconoce
 * llega como aviso, y el inventario se descuenta hasta que se acepta.
 *
 * Todavia no le contesta a Rappi (aceptar, rechazar, listo): eso necesita las
 * credenciales de integrador.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class RappiService {

    private static final JsonMapper JSON = JsonMapper.builder().build();

    private final RappiTiendaRepository tiendaRepository;
    private final PedidoRappiRepository pedidoRappiRepository;
    private final BranchRepository branchRepository;
    private final OrderRepository orderRepository;
    private final OrderItemRepository orderItemRepository;
    private final ProductRepository productRepository;
    private final AdicionalesService adicionalesService;
    private final DeliveryService deliveryService;

    @Value("${rappi.webhook-secret:}")
    private String secretoWebhook;

    /** Sin secreto la integracion esta apagada: no se acepta ningun aviso. */
    public boolean activa() {
        return secretoWebhook != null && !secretoWebhook.isBlank();
    }

    public boolean firmaValida(String encabezado, String cuerpo) {
        return RappiFirma.esValida(encabezado, cuerpo, secretoWebhook);
    }

    // ------------------------------------------------------------------
    // Pedidos nuevos
    // ------------------------------------------------------------------

    /**
     * NEW_ORDER. Trae un pedido, o una lista como la de GET orders. Devuelve
     * los pedidos que se crearon; los repetidos se ignoran, porque Rappi puede
     * mandar el mismo aviso mas de una vez.
     */
    @Transactional
    public List<UUID> recibirPedidos(String cuerpo) {
        JsonNode raiz = JSON.readTree(cuerpo);
        List<UUID> creados = new ArrayList<>();
        if (raiz.isArray()) {
            for (JsonNode pedido : raiz) {
                recibir(pedido).ifPresent(creados::add);
            }
        } else {
            recibir(raiz).ifPresent(creados::add);
        }
        return creados;
    }

    private Optional<UUID> recibir(JsonNode nodo) {
        RappiPedidoEntrante p = RappiPedidoEntrante.leer(nodo);
        if (pedidoRappiRepository.existsByRappiOrderId(p.orderId())) {
            log.info("Rappi: el pedido {} ya se habia recibido, se ignora", p.orderId());
            return Optional.empty();
        }

        RappiTienda tienda = tiendaDe(p.storeId(), p.storeIdExterno())
                .orElseThrow(() -> new IllegalArgumentException(
                        "La tienda " + p.storeId() + " de Rappi no está ligada a ninguna sucursal."));
        Branch branch = branchRepository.findById(tienda.getBranchId())
                .orElseThrow(() -> new IllegalArgumentException("Sucursal no encontrada."));
        UUID restaurantId = branch.getRestaurant().getId();

        boolean conDireccion = !p.paraRecoger();
        Order order = orderRepository.save(Order.builder()
                .branch(branch)
                .table(null)
                .customer(null)
                .status(OrderStatus.OPEN)
                .orderType(p.paraRecoger() ? OrderType.PARA_LLEVAR : OrderType.DOMICILIO)
                .deliveryStatus(DeliveryStatus.NUEVO)
                .totalAmount(BigDecimal.ZERO)
                .direccionEntrega(conDireccion ? p.direccion() : null)
                .referenciasEntrega(conDireccion ? p.complemento() : null)
                .envioCobrado(BigDecimal.ZERO)
                .minutosEstimados(p.minutosCocina())
                .tokenSeguimiento(DeliveryService.nuevoToken())
                .origen("RAPPI")
                .clienteExterno(p.cliente())
                .pedidoExterno(p.orderId())
                .descontarAlAceptar(true)
                .repartoExterno(p.repartoDeRappi())
                .build());

        List<GrupoAdicional> grupos = adicionalesService.gruposActivos(restaurantId);
        List<OrderItem> items = new ArrayList<>();
        List<String> sinLigar = new ArrayList<>();
        BigDecimal subtotal = BigDecimal.ZERO;

        for (RappiPedidoEntrante.Linea linea : p.lineas()) {
            Product producto = ligarProducto(linea, restaurantId);
            if (producto == null) {
                sinLigar.add(linea.describir());
                continue;
            }
            AdicionalesService.EleccionBot eleccion = adicionalesService.resolverExterno(producto,
                    linea.subitems().stream()
                            .map(s -> new AdicionalesService.OpcionExterna(s.sku(), s.nombre(), s.precio(), s.cantidad()))
                            .toList(),
                    grupos);
            OrderItem item = OrderItem.builder()
                    .order(order)
                    .product(producto)
                    .quantity(linea.cantidad())
                    .unitPrice(producto.getPrice())
                    .specialInstructions(nota(linea.comentarios(), eleccion.avisos()))
                    .build();
            adicionalesService.aplicarALinea(item, eleccion.eleccion());
            // Lo que cobro Rappi, que puede no ser el precio de nuestro menu.
            item.setUnitPrice(linea.precioUnitario());
            subtotal = subtotal.add(item.getUnitPrice().multiply(BigDecimal.valueOf(linea.cantidad())));
            items.add(item);
        }

        orderItemRepository.saveAll(items);
        order.setTotalAmount(subtotal);
        order.setNotasEntrega(notasDelPedido(p, sinLigar));
        orderRepository.save(order);

        pedidoRappiRepository.save(PedidoRappi.builder()
                .orderId(order.getId())
                .rappiOrderId(p.orderId())
                .storeId(tienda.getStoreId())
                .metodoEntrega(p.metodoEntrega())
                .metodoPago(p.metodoPago())
                .totalRappi(p.totalOrden())
                .efectivoACobrar(p.efectivoACobrar())
                .minutosCocina(p.minutosCocina())
                .minutosCocinaMin(p.minutosCocinaMin())
                .minutosCocinaMax(p.minutosCocinaMax())
                .sinLigar(sinLigar.isEmpty() ? null : String.join("\n", sinLigar))
                .payload(nodo.toString())
                .build());

        deliveryService.publicarTableroDe(branch.getId());
        log.info("Rappi: pedido {} entro a la sucursal {} como {} ({} platillos, {} sin ligar)",
                p.orderId(), branch.getId(), order.getTokenSeguimiento(), items.size(), sinLigar.size());
        return Optional.of(order.getId());
    }

    /**
     * El platillo del menu que corresponde a la linea. Primero por SKU, que es
     * nuestro id cuando el menu se publica desde aqui; si no, por nombre
     * exacto. No se adivina por parecido: un platillo equivocado sale de
     * cocina, uno sin ligar llega como aviso.
     */
    private Product ligarProducto(RappiPedidoEntrante.Linea linea, UUID restaurantId) {
        UUID id = comoUuid(linea.sku());
        if (id != null) {
            Optional<Product> porSku = productRepository.findById(id)
                    .filter(pr -> pr.getCategory() != null && pr.getCategory().getRestaurant() != null
                            && restaurantId.equals(pr.getCategory().getRestaurant().getId()));
            if (porSku.isPresent()) return porSku.get();
        }
        if (linea.nombre() == null) return null;
        String buscado = AdicionalesService.normalizar(linea.nombre());
        return productRepository
                .findByCategoryRestaurantIdAndActiveTrueAndNameContainingIgnoreCase(restaurantId, linea.nombre().trim())
                .stream()
                .filter(pr -> AdicionalesService.normalizar(pr.getName()).equals(buscado))
                .findFirst()
                .orElse(null);
    }

    /** Lo que el mostrador tiene que saber antes de aceptar. */
    static String notasDelPedido(RappiPedidoEntrante p, List<String> sinLigar) {
        List<String> renglones = new ArrayList<>();
        renglones.add("Rappi #" + p.orderId());
        if (!sinLigar.isEmpty()) {
            renglones.add("⚠️ No están en tu menú, revísalos antes de aceptar: " + String.join("; ", sinLigar));
        }
        if (p.paraRecoger()) {
            renglones.add("El cliente pasa a recogerlo.");
        }
        if (p.efectivoACobrar() != null) {
            renglones.add("Cobrar $" + p.efectivoACobrar() + " en efectivo.");
        } else if (!p.repartoDeRappi()) {
            renglones.add("Pagado en Rappi: no cobrar al cliente.");
        }
        String notas = String.join("\n", renglones);
        return notas.length() > 300 ? notas.substring(0, 297) + "..." : notas;
    }

    private static String nota(String comentarios, List<String> avisos) {
        List<String> partes = new ArrayList<>();
        if (comentarios != null && !comentarios.isBlank()) partes.add(comentarios.trim());
        partes.addAll(avisos);
        return partes.isEmpty() ? null : String.join(" · ", partes);
    }

    // ------------------------------------------------------------------
    // Cambios que avisa Rappi
    // ------------------------------------------------------------------

    /**
     * ORDER_EVENT_CANCEL: el cliente o Rappi cancelaron. Sale del tablero como
     * cualquier cancelacion; si nunca se acepto no hay inventario que devolver.
     */
    @Transactional
    public void cancelar(String cuerpo) {
        JsonNode evento = JSON.readTree(cuerpo);
        String rappiOrderId = evento.path("order_id").asString();
        PedidoRappi pedido = pedidoRappiRepository.findByRappiOrderId(rappiOrderId).orElse(null);
        if (pedido == null) {
            log.warn("Rappi: cancelacion de un pedido que no conocemos ({})", rappiOrderId);
            return;
        }
        anotarEvento(pedido, evento.path("event").asString("cancel"));

        Order order = orderRepository.findById(pedido.getOrderId()).orElseThrow();
        if (order.getDeliveryStatus() != null && order.getDeliveryStatus().esFinal()) {
            return;
        }
        deliveryService.cambiarEstado(order.getBranch().getId(), order.getId(),
                new CambiarEstadoEntregaDTO(DeliveryStatus.CANCELADO, "Cancelado en Rappi"));
    }

    /**
     * ORDER_OTHER_EVENT: el repartidor tomo el pedido, llego, etc. Por ahora
     * solo se anota para el mostrador: Rappi no documenta todos los eventos y
     * mover el pedido con uno que no entendemos lo dejaria en un estado falso.
     */
    @Transactional
    public void otroEvento(String cuerpo) {
        JsonNode evento = JSON.readTree(cuerpo);
        pedidoRappiRepository.findByRappiOrderId(evento.path("order_id").asString()).ifPresent(pedido -> {
            anotarEvento(pedido, evento.path("event").asString(null));
            String repartidor = evento.path("additional_information").path("courier_data").path("full_name").asString(null);
            if (repartidor != null && !repartidor.isBlank()) {
                pedido.setRepartidor(repartidor.length() > 120 ? repartidor.substring(0, 120) : repartidor);
            }
            pedidoRappiRepository.save(pedido);
            orderRepository.findById(pedido.getOrderId())
                    .ifPresent(o -> deliveryService.publicarTableroDe(o.getBranch().getId()));
        });
    }

    private static void anotarEvento(PedidoRappi pedido, String evento) {
        if (evento != null && !evento.isBlank()) {
            pedido.setUltimoEvento(evento.length() > 60 ? evento.substring(0, 60) : evento);
        }
        pedido.setUltimoEventoEn(LocalDateTime.now());
    }

    /** PING: Rappi pregunta si la tienda puede recibir pedidos. */
    @Transactional(readOnly = true)
    public String ping(String cuerpo) {
        JsonNode ping = JSON.readTree(cuerpo);
        String storeId = ping.path("store_id").asString();
        return tiendaDe(storeId, null)
                .flatMap(t -> branchRepository.findById(t.getBranchId()))
                .map(b -> Boolean.FALSE.equals(b.getActive()) ? "Sucursal desactivada" : "Tienda prendida")
                .orElse("Tienda sin ligar");
    }

    /** STORE_CONNECTIVITY: Rappi prendio o apago la tienda. */
    @Transactional
    public void conectividad(String cuerpo) {
        JsonNode aviso = JSON.readTree(cuerpo);
        String storeId = aviso.path("external_store_id").asString(null);
        if (storeId == null) storeId = aviso.path("store_id").asString(null);
        tiendaDe(storeId, storeId).ifPresentOrElse(tienda -> {
            tienda.setHabilitada(aviso.path("enabled").asBoolean());
            String mensaje = aviso.path("message").asString(null);
            tienda.setMensaje(mensaje != null && mensaje.length() > 300 ? mensaje.substring(0, 300) : mensaje);
            tienda.setActualizadaEn(LocalDateTime.now());
            tiendaRepository.save(tienda);
            log.info("Rappi: la tienda {} quedo {}", tienda.getStoreId(),
                    Boolean.TRUE.equals(tienda.getHabilitada()) ? "habilitada" : "deshabilitada");
        }, () -> log.warn("Rappi: aviso de conectividad de una tienda sin ligar ({})", cuerpo));
    }

    /**
     * La tienda ligada: por el id de Rappi o, si Rappi manda el nuestro
     * (external_id = id de la sucursal, que es como se liga), por ese.
     */
    private Optional<RappiTienda> tiendaDe(String storeId, String idExterno) {
        if (storeId != null && !storeId.isBlank()) {
            Optional<RappiTienda> porRappi = tiendaRepository.findByStoreId(storeId.trim());
            if (porRappi.isPresent()) return porRappi;
        }
        UUID branchId = comoUuid(idExterno);
        return branchId != null ? tiendaRepository.findById(branchId) : Optional.empty();
    }

    // ------------------------------------------------------------------
    // Ligar sucursales
    // ------------------------------------------------------------------

    @Transactional(readOnly = true)
    public Optional<RappiTienda> tienda(UUID branchId) {
        return tiendaRepository.findById(branchId);
    }

    /** Liga la sucursal con su tienda de Rappi, o le cambia la tienda. */
    @Transactional
    public RappiTienda ligar(UUID branchId, String storeId) {
        String limpio = storeId == null ? "" : storeId.trim();
        if (!limpio.matches("[0-9A-Za-z_-]{1,40}")) {
            throw new IllegalArgumentException("Escribe el id de la tienda tal como aparece en Rappi.");
        }
        tiendaRepository.findByStoreId(limpio)
                .filter(t -> !t.getBranchId().equals(branchId))
                .ifPresent(t -> {
                    throw new IllegalStateException("Esa tienda de Rappi ya está ligada a otra sucursal.");
                });
        RappiTienda tienda = tiendaRepository.findById(branchId)
                .orElseGet(() -> RappiTienda.builder().branchId(branchId).build());
        tienda.setStoreId(limpio);
        tienda.setActualizadaEn(LocalDateTime.now());
        return tiendaRepository.save(tienda);
    }

    @Transactional
    public void desligar(UUID branchId) {
        tiendaRepository.deleteById(branchId);
    }

    private static UUID comoUuid(String texto) {
        if (texto == null) return null;
        try {
            return UUID.fromString(texto.trim());
        } catch (IllegalArgumentException e) {
            return null;
        }
    }
}
