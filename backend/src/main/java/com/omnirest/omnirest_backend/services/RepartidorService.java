package com.omnirest.omnirest_backend.services;

import com.omnirest.omnirest_backend.domain.entities.BranchDeliverySettings;
import com.omnirest.omnirest_backend.domain.entities.Driver;
import com.omnirest.omnirest_backend.domain.entities.Order;
import com.omnirest.omnirest_backend.domain.entities.OrderItem;
import com.omnirest.omnirest_backend.domain.enums.DeliveryStatus;
import com.omnirest.omnirest_backend.domain.enums.KitchenStatus;
import com.omnirest.omnirest_backend.dtos.CambiarEstadoEntregaDTO;
import com.omnirest.omnirest_backend.dtos.EntregaRepartidorDTO;
import com.omnirest.omnirest_backend.dtos.ReporteRepartidorDTO;
import com.omnirest.omnirest_backend.dtos.TomarEntregaDTO;
import com.omnirest.omnirest_backend.repositories.BranchDeliverySettingsRepository;
import com.omnirest.omnirest_backend.repositories.DriverRepository;
import com.omnirest.omnirest_backend.repositories.OrderItemRepository;
import com.omnirest.omnirest_backend.repositories.OrderRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/**
 * El lado del repartidor.
 *
 * El pedido se publica en el grupo de WhatsApp del negocio con un enlace. Quien
 * lo abre se registra con su propio numero la primera vez y toma la entrega;
 * desde entonces queda identificado, y por eso se puede saber quien llevo cada
 * pedido y cuanto se le debe.
 *
 * No hay cuentas ni contrasenas: el enlace circula en un grupo cerrado y el
 * numero de WhatsApp es la identidad.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class RepartidorService {

    private final OrderRepository orderRepository;
    private final OrderItemRepository orderItemRepository;
    private final DriverRepository driverRepository;
    private final BranchDeliverySettingsRepository deliverySettingsRepository;
    private final DeliveryService deliveryService;

    /** Lo que ve quien abre el enlace, identificandose o no con su telefono. */
    @Transactional(readOnly = true)
    public EntregaRepartidorDTO verEntrega(String token, String phoneNumber) {
        return aDto(buscarPedido(token), normalizar(phoneNumber));
    }

    /**
     * El repartidor toma la entrega. Si es su primera vez queda registrado con
     * el numero desde el que la tomo.
     */
    @Transactional
    public EntregaRepartidorDTO tomarEntrega(String token, TomarEntregaDTO peticion) {
        Order order = buscarPedido(token);
        String telefono = TelefonoMx.exigirValido(peticion.phoneNumber(), "tu WhatsApp");

        DeliveryStatus estado = order.getDeliveryStatus();
        if (estado == null || estado.esFinal()) {
            throw new IllegalStateException("Esta entrega ya está cerrada.");
        }
        if (estado == DeliveryStatus.NUEVO) {
            throw new IllegalStateException("El restaurante todavía no confirma este pedido.");
        }

        // Dos repartidores pueden abrir el enlace a la vez. El primero se la
        // lleva; al segundo se le dice quien la tomo, no un error seco.
        Driver yaAsignado = order.getDriver();
        if (yaAsignado != null) {
            if (!telefono.equals(normalizar(yaAsignado.getPhoneNumber()))) {
                throw new IllegalStateException("Esta entrega ya la tomó " + yaAsignado.getNombre() + ".");
            }
            return aDto(order, telefono);
        }

        Driver repartidor = registrarOBuscar(order, telefono, peticion.nombre(), peticion.vehiculo());

        order.setDriver(repartidor);
        order.setAsignadoEn(LocalDateTime.now());
        order.setPagoRepartidor(calcularPago(order));
        orderRepository.save(order);

        log.info("Entrega {} asignada a {} ({})", token, repartidor.getNombre(), telefono);

        // Tomarla es hacerse responsable, no salir a repartir: el pedido puede
        // seguir en la cocina. El estado avanza cuando pasan las cosas de
        // verdad — cocina lo libera, el mostrador lo empaca y el repartidor lo
        // recoge—, no porque alguien haya apretado un boton antes de tiempo.
        deliveryService.publicarTableroDe(order.getBranch().getId());

        return aDto(order, telefono);
    }

    /**
     * El repartidor ya recogio el pedido y sale a la calle. Es el unico momento
     * en que el pedido pasa a EN_CAMINO, y hasta que esta empacado.
     */
    @Transactional
    public EntregaRepartidorDTO marcarEnCamino(String token, String phoneNumber) {
        Order order = buscarPedido(token);
        Driver repartidor = exigirQueSeaSuya(order, phoneNumber);

        if (order.getDeliveryStatus() != DeliveryStatus.LISTO) {
            throw new IllegalStateException(
                    "El pedido todavía no está empacado. En cuanto el restaurante lo entregue, podrás salir.");
        }

        log.info("Entrega {} recogida por {}", token, repartidor.getNombre());

        deliveryService.cambiarEstado(
                order.getBranch().getId(), order.getId(),
                new CambiarEstadoEntregaDTO(DeliveryStatus.EN_CAMINO, null));

        return aDto(buscarPedido(token), normalizar(phoneNumber));
    }

    /** El repartidor cierra su entrega desde el mismo enlace. */
    @Transactional
    public EntregaRepartidorDTO marcarEntregado(String token, String phoneNumber) {
        Order order = buscarPedido(token);

        Driver repartidor = exigirQueSeaSuya(order, phoneNumber);

        if (order.getDeliveryStatus() == DeliveryStatus.CONFIRMADO) {
            throw new IllegalStateException(
                    "El pedido todavía no está empacado, no puedes darlo por entregado.");
        }

        repartidor.setUltimaEntrega(LocalDateTime.now());
        driverRepository.save(repartidor);

        deliveryService.cambiarEstado(
                order.getBranch().getId(), order.getId(),
                new CambiarEstadoEntregaDTO(DeliveryStatus.ENTREGADO, null));

        return aDto(buscarPedido(token), normalizar(phoneNumber));
    }

    /**
     * El repartidor ya no puede llevarla (se le poncho la llanta, tomo la
     * equivocada). Solo antes de salir: con la comida en la calle, quien
     * decide es el restaurante. La entrega vuelve a quedar disponible.
     */
    @Transactional
    public EntregaRepartidorDTO soltarEntrega(String token, String phoneNumber) {
        Order order = buscarPedido(token);
        Driver repartidor = exigirQueSeaSuya(order, phoneNumber);
        if (order.getDeliveryStatus() == DeliveryStatus.EN_CAMINO) {
            throw new IllegalStateException("Ya vas en camino: si no puedes entregarla, llama al restaurante.");
        }
        deliveryService.quitarRepartidor(order);
        log.info("Entrega {} soltada por {}", token, repartidor.getNombre());
        return aDto(buscarPedido(token), normalizar(phoneNumber));
    }

    /**
     * Comprueba que quien pide la accion sea el repartidor que tiene asignada
     * la entrega. El enlace circula en un grupo, asi que cualquiera podria
     * abrirlo y mover un pedido que no lleva.
     */
    private Driver exigirQueSeaSuya(Order order, String phoneNumber) {
        Driver repartidor = order.getDriver();
        if (repartidor == null) {
            throw new IllegalStateException("Esta entrega todavía no la ha tomado nadie.");
        }
        if (!normalizar(phoneNumber).equals(normalizar(repartidor.getPhoneNumber()))) {
            throw new IllegalStateException("Esta entrega la lleva " + repartidor.getNombre() + ".");
        }
        if (order.getDeliveryStatus() != null && order.getDeliveryStatus().esFinal()) {
            throw new IllegalStateException("Esta entrega ya está cerrada.");
        }
        return repartidor;
    }

    /** Los repartidores del restaurante, para el panel y los reportes. */
    @Transactional(readOnly = true)
    public List<Driver> listarPorRestaurante(java.util.UUID restaurantId) {
        return driverRepository.findByRestaurantIdOrderByNombreAsc(restaurantId);
    }

    /**
     * Resumen por repartidor para pagar y dar seguimiento. Sin fechas, toma el
     * dia de hoy: es lo que se revisa al cerrar el turno.
     */
    @Transactional(readOnly = true)
    public List<ReporteRepartidorDTO> reporte(java.util.UUID branchId, LocalDate desde, LocalDate hasta) {
        LocalDate inicio = desde != null ? desde : LocalDate.now();
        // El rango es inclusivo en pantalla, asi que por dentro se corre un dia:
        // "del 1 al 5" tiene que incluir todo el dia 5.
        LocalDate fin = (hasta != null ? hasta : inicio).plusDays(1);

        if (fin.isBefore(inicio)) {
            throw new IllegalArgumentException("La fecha final no puede ser anterior a la inicial.");
        }

        return orderRepository.reportePorRepartidor(branchId, inicio.atStartOfDay(), fin.atStartOfDay());
    }

    // ------------------------------------------------------------------
    // Apoyos
    // ------------------------------------------------------------------

    private Driver registrarOBuscar(Order order, String telefono, String nombre, String vehiculo) {
        var restaurante = order.getBranch().getRestaurant();

        Driver repartidor = driverRepository
                .findByRestaurantIdAndPhoneNumber(restaurante.getId(), telefono)
                .orElseGet(() -> Driver.builder()
                        .restaurant(restaurante)
                        .phoneNumber(telefono)
                        .nombre("Repartidor")
                        .build());

        if (Boolean.FALSE.equals(repartidor.getActivo())) {
            throw new IllegalStateException("Tu acceso como repartidor está desactivado. Habla con el restaurante.");
        }
        if (nombre != null && !nombre.isBlank()) {
            repartidor.setNombre(nombre.trim());
        }
        if (vehiculo != null && !vehiculo.isBlank()) {
            repartidor.setVehiculo(vehiculo.trim());
        }

        return driverRepository.save(repartidor);
    }

    /**
     * Pago fijo por entrega mas lo que corresponda por distancia, con la tarifa
     * vigente al momento de tomarla.
     */
    private BigDecimal calcularPago(Order order) {
        BranchDeliverySettings config = deliverySettingsRepository
                .findById(order.getBranch().getId())
                .orElse(null);
        if (config == null) {
            return BigDecimal.ZERO;
        }

        return CalculadoraEnvio.pagoRepartidor(config.getPagoRepartidorFijo(), config.getPagoRepartidorKm(),
                order.getDistanciaKm());
    }

    private Order buscarPedido(String token) {
        return orderRepository.findByTokenSeguimiento(token)
                .orElseThrow(() -> new IllegalArgumentException("No encontramos esta entrega. Revisa el enlace."));
    }

    /**
     * Forma canonica del telefono. Sin esto el mismo repartidor se registra dos
     * veces —una como 52955… y otra como 521955…, que es como lo entrega
     * WhatsApp— y su reporte sale partido en dos.
     */
    private String normalizar(String telefono) {
        return TelefonoMx.canonico(telefono);
    }

    private EntregaRepartidorDTO aDto(Order order, String telefonoConsulta) {
        Driver repartidor = order.getDriver();
        boolean esMia = repartidor != null
                && !telefonoConsulta.isEmpty()
                && telefonoConsulta.equals(normalizar(repartidor.getPhoneNumber()));

        List<String> platillos = orderItemRepository.findByOrderId(order.getId()).stream()
                .filter(i -> i.getKitchenStatus() != KitchenStatus.CANCELLED)
                .map(this::describir)
                .toList();

        BigDecimal aCobrar = order.getTotalAmount() != null ? order.getTotalAmount() : BigDecimal.ZERO;
        aCobrar = aCobrar
                .add(order.getEnvioCobrado() != null ? order.getEnvioCobrado() : BigDecimal.ZERO)
                .add(order.getPropina() != null ? order.getPropina() : BigDecimal.ZERO);

        BigDecimal cambio = null;
        if (order.getPagaCon() != null && order.getPagaCon().compareTo(aCobrar) > 0) {
            cambio = order.getPagaCon().subtract(aCobrar);
        }

        // El enlace circula en un grupo: los datos del cliente (nombre,
        // telefono, pin exacto) solo los ve quien lleva la entrega. Antes de
        // tomarla se ve la direccion y lo que hay que cobrar, para decidir; si
        // ya la tomo otro, solo que ya tiene dueno.
        boolean disponible = repartidor == null;
        boolean completa = esMia;
        boolean paraDecidir = disponible || esMia;

        return new EntregaRepartidorDTO(
                order.getTokenSeguimiento(),
                order.getDeliveryStatus(),
                disponible,
                esMia,
                repartidor != null ? repartidor.getNombre() : null,
                order.getDeliveryStatus() == DeliveryStatus.LISTO,
                order.getBranch().getName(),
                order.getBranch().getAddress(),
                completa && order.getCustomer() != null ? order.getCustomer().getName() : null,
                completa && order.getCustomer() != null ? order.getCustomer().getPhoneNumber() : null,
                paraDecidir ? order.getDireccionEntrega() : null,
                completa ? order.getReferenciasEntrega() : null,
                completa ? order.getNotasEntrega() : null,
                completa ? order.getLatitudEntrega() : null,
                completa ? order.getLongitudEntrega() : null,
                paraDecidir ? order.getDistanciaKm() : null,
                paraDecidir ? platillos : List.of(),
                paraDecidir ? aCobrar : null,
                paraDecidir ? order.getPagaCon() : null,
                paraDecidir ? cambio : null,
                paraDecidir ? (order.getPagoRepartidor() != null ? order.getPagoRepartidor() : calcularPago(order)) : null);
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
