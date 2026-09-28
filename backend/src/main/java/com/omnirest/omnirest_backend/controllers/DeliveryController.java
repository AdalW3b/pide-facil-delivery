package com.omnirest.omnirest_backend.controllers;

import com.omnirest.omnirest_backend.dtos.CambiarEstadoEntregaDTO;
import com.omnirest.omnirest_backend.dtos.CotizacionEnvioRequestDTO;
import com.omnirest.omnirest_backend.dtos.CotizacionEnvioResponseDTO;
import com.omnirest.omnirest_backend.dtos.CrearPedidoDomicilioRequestDTO;
import com.omnirest.omnirest_backend.dtos.DeliverySettingsDTO;
import com.omnirest.omnirest_backend.dtos.MenuPublicoCategoriaDTO;
import com.omnirest.omnirest_backend.dtos.PedidoDomicilioPanelDTO;
import com.omnirest.omnirest_backend.dtos.EntregaRepartidorDTO;
import com.omnirest.omnirest_backend.dtos.PedidoDomicilioResponseDTO;
import com.omnirest.omnirest_backend.dtos.ReporteRepartidorDTO;
import com.omnirest.omnirest_backend.dtos.TomarEntregaDTO;
import com.omnirest.omnirest_backend.services.DeliveryService;
import com.omnirest.omnirest_backend.services.RepartidorService;
import com.omnirest.omnirest_backend.services.WhatsappIntegrationService;
import com.omnirest.omnirest_backend.services.SecurityValidationService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Pedidos a domicilio.
 *
 * Las rutas bajo {@code /public} las consume el menu web al que entra el
 * cliente por un enlace, sin cuenta ni sesion: la sucursal viene en la URL. Las
 * demas son del panel y piden usuario.
 */
@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
public class DeliveryController {

    private final DeliveryService deliveryService;
    private final RepartidorService repartidorService;
    private final WhatsappIntegrationService whatsappIntegrationService;
    private final SecurityValidationService securityValidationService;
    private final com.omnirest.omnirest_backend.services.CuadreService cuadreService;

    // ------------------------------------------------------------------
    // Menu web del cliente (publico)
    // ------------------------------------------------------------------

    /** Encabezado del menu en linea: restaurante, tiempo y costo de envio. */
    @GetMapping("/public/branches/{branchId}/info")
    public ResponseEntity<com.omnirest.omnirest_backend.dtos.InfoPublicaSucursalDTO> infoPublica(@PathVariable UUID branchId) {
        return ResponseEntity.ok(deliveryService.infoPublica(branchId));
    }

    /** El menu que ve quien abre el enlace de la sucursal. */
    @GetMapping("/public/branches/{branchId}/menu")
    public ResponseEntity<List<MenuPublicoCategoriaDTO>> menuPublico(@PathVariable UUID branchId) {
        return ResponseEntity.ok(deliveryService.menuPublico(branchId));
    }

    // ------------------------------------------------------------------
    // Cuadre de efectivo de los repartidores
    // ------------------------------------------------------------------

    @GetMapping("/branches/{branchId}/delivery/cuadre/pendientes")
    @PreAuthorize("hasAnyAuthority('SUPER_ADMIN', 'SYSTEM_ADMIN', 'ORDERS_READ')")
    public ResponseEntity<List<com.omnirest.omnirest_backend.dtos.CuadreDTOs.Pendiente>> cuadrePendientes(
            @PathVariable UUID branchId) {
        securityValidationService.validateUserAccessToBranch(branchId);
        return ResponseEntity.ok(cuadreService.pendientes(branchId));
    }

    @PostMapping("/branches/{branchId}/delivery/cuadre")
    @PreAuthorize("hasAnyAuthority('SUPER_ADMIN', 'SYSTEM_ADMIN', 'ORDERS_UPDATE')")
    public ResponseEntity<com.omnirest.omnirest_backend.dtos.CuadreDTOs.Corte> cerrarCuadre(
            @PathVariable UUID branchId,
            @jakarta.validation.Valid @RequestBody com.omnirest.omnirest_backend.dtos.CuadreDTOs.CerrarCorte request,
            @org.springframework.security.core.annotation.AuthenticationPrincipal
            com.omnirest.omnirest_backend.security.CustomUserDetails user) {
        securityValidationService.validateUserAccessToBranch(branchId);
        return ResponseEntity.ok(cuadreService.cerrar(branchId, request, user));
    }

    @GetMapping("/branches/{branchId}/delivery/cuadre/historial")
    @PreAuthorize("hasAnyAuthority('SUPER_ADMIN', 'SYSTEM_ADMIN', 'ORDERS_READ')")
    public ResponseEntity<List<com.omnirest.omnirest_backend.dtos.CuadreDTOs.Corte>> historialCuadre(
            @PathVariable UUID branchId) {
        securityValidationService.validateUserAccessToBranch(branchId);
        return ResponseEntity.ok(cuadreService.historial(branchId));
    }

    /** Quien llama: nombre y direcciones guardadas, para no volver a dictarlas. */
    @GetMapping("/branches/{branchId}/delivery/clientes")
    @PreAuthorize("hasAnyAuthority('SUPER_ADMIN', 'SYSTEM_ADMIN', 'ORDERS_READ')")
    public ResponseEntity<com.omnirest.omnirest_backend.dtos.ClienteTelefonoDTO> buscarCliente(
            @PathVariable UUID branchId, @RequestParam String telefono) {
        securityValidationService.validateUserAccessToBranch(branchId);
        return ResponseEntity.ok(deliveryService.buscarCliente(branchId, telefono));
    }

    /** Pedido capturado por telefono: nace confirmado y va directo a cocina. */
    @PostMapping("/branches/{branchId}/delivery/orders/telefono")
    @PreAuthorize("hasAnyAuthority('SUPER_ADMIN', 'SYSTEM_ADMIN', 'ORDERS_CREATE', 'ORDERS_UPDATE')")
    public ResponseEntity<PedidoDomicilioResponseDTO> crearPedidoTelefonico(
            @PathVariable UUID branchId,
            @jakarta.validation.Valid @RequestBody com.omnirest.omnirest_backend.dtos.PedidoTelefonicoDTO request) {
        securityValidationService.validateUserAccessToBranch(branchId);
        return ResponseEntity.status(org.springframework.http.HttpStatus.CREATED)
                .body(deliveryService.crearPedidoTelefonico(branchId, request));
    }

    /** Ids de lo mas pedido en la sucursal, en orden. */
    @GetMapping("/public/branches/{branchId}/menu/mas-pedidos")
    public ResponseEntity<List<UUID>> masPedidos(@PathVariable UUID branchId) {
        return ResponseEntity.ok(deliveryService.masPedidos(branchId));
    }

    /**
     * Cuanto costaria el envio a ese pin. Se consulta antes de pedir, cada vez
     * que el cliente mueve el marcador en el mapa.
     */
    @PostMapping("/public/branches/{branchId}/delivery/quote")
    public ResponseEntity<CotizacionEnvioResponseDTO> cotizar(
            @PathVariable UUID branchId,
            @Valid @RequestBody CotizacionEnvioRequestDTO request) {
        return ResponseEntity.ok(deliveryService.cotizar(branchId, request.latitud(), request.longitud()));
    }

    /** Crea el pedido a domicilio y devuelve el codigo de seguimiento. */
    @PostMapping("/public/branches/{branchId}/delivery/orders")
    public ResponseEntity<PedidoDomicilioResponseDTO> crearPedido(
            @PathVariable UUID branchId,
            @Valid @RequestBody CrearPedidoDomicilioRequestDTO request) {
        PedidoDomicilioResponseDTO pedido = deliveryService.crearPedido(branchId, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(pedido);
    }

    // ------------------------------------------------------------------
    // Repartidor (publico)
    // ------------------------------------------------------------------
    // El enlace circula en el grupo de WhatsApp del negocio. El repartidor se
    // identifica con su numero, no con una cuenta: el token del pedido es lo
    // que autoriza, igual que el enlace del menu para el cliente.

    /** Lo que ve el repartidor al abrir el enlace del grupo. */
    @GetMapping("/public/delivery/{token}")
    public ResponseEntity<EntregaRepartidorDTO> verEntrega(
            @PathVariable String token,
            @RequestParam(required = false) String telefono) {
        return ResponseEntity.ok(repartidorService.verEntrega(token, telefono));
    }

    /** Toma la entrega; si es su primera vez, queda registrado. */
    @PostMapping("/public/delivery/{token}/tomar")
    public ResponseEntity<EntregaRepartidorDTO> tomarEntrega(
            @PathVariable String token,
            @Valid @RequestBody TomarEntregaDTO request) {
        return ResponseEntity.ok(repartidorService.tomarEntrega(token, request));
    }

    /** El repartidor recogio el pedido y sale a la calle. */
    @PostMapping("/public/delivery/{token}/en-camino")
    public ResponseEntity<EntregaRepartidorDTO> marcarEnCamino(
            @PathVariable String token,
            @RequestBody Map<String, String> payload) {
        return ResponseEntity.ok(
                repartidorService.marcarEnCamino(token, payload != null ? payload.get("phoneNumber") : null));
    }

    /** El repartidor cierra su entrega. */
    @PostMapping("/public/delivery/{token}/entregado")
    public ResponseEntity<EntregaRepartidorDTO> marcarEntregado(
            @PathVariable String token,
            @RequestBody Map<String, String> payload) {
        return ResponseEntity.ok(
                repartidorService.marcarEntregado(token, payload != null ? payload.get("phoneNumber") : null));
    }

    // ------------------------------------------------------------------
    // Tablero de reparto (panel)
    // ------------------------------------------------------------------

    /**
     * Los pedidos a domicilio de la sucursal. Por omision solo los vivos;
     * {@code soloActivos=false} agrega los entregados y cancelados, y
     * {@code desde} los acota a partir de una fecha.
     */
    @GetMapping("/branches/{branchId}/delivery/orders")
    @PreAuthorize("hasAnyAuthority('SUPER_ADMIN', 'SYSTEM_ADMIN', 'ORDERS_READ')")
    public ResponseEntity<List<PedidoDomicilioPanelDTO>> listarPedidos(
            @PathVariable UUID branchId,
            @RequestParam(defaultValue = "true") boolean soloActivos,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime desde) {
        securityValidationService.validateUserAccessToBranch(branchId);
        return ResponseEntity.ok(deliveryService.listarPedidos(branchId, soloActivos, desde));
    }

    /** Aceptar, marcar listo, en camino, entregado o cancelar. */
    @PatchMapping("/branches/{branchId}/delivery/orders/{orderId}/status")
    @PreAuthorize("hasAnyAuthority('SUPER_ADMIN', 'SYSTEM_ADMIN', 'ORDERS_UPDATE')")
    public ResponseEntity<PedidoDomicilioPanelDTO> cambiarEstado(
            @PathVariable UUID branchId,
            @PathVariable UUID orderId,
            @Valid @RequestBody CambiarEstadoEntregaDTO request) {
        securityValidationService.validateUserAccessToBranch(branchId);
        return ResponseEntity.ok(deliveryService.cambiarEstado(branchId, orderId, request));
    }

    /** Manda la entrega al grupo de repartidores, o la vuelve a ofrecer. */
    @PostMapping("/branches/{branchId}/delivery/orders/{orderId}/publicar")
    @PreAuthorize("hasAnyAuthority('SUPER_ADMIN', 'SYSTEM_ADMIN', 'ORDERS_UPDATE')")
    public ResponseEntity<Map<String, String>> publicarEnGrupo(
            @PathVariable UUID branchId,
            @PathVariable UUID orderId) {
        securityValidationService.validateUserAccessToBranch(branchId);
        return ResponseEntity.ok(Map.of("message", deliveryService.publicarAhora(branchId, orderId)));
    }

    // ------------------------------------------------------------------
    // Reportes de reparto (panel)
    // ------------------------------------------------------------------

    /**
     * Cuanto trabajo y cuanto se le debe a cada repartidor. Sin fechas toma el
     * dia de hoy, que es lo que se revisa al cerrar el turno.
     */
    @GetMapping("/branches/{branchId}/delivery/reports/drivers")
    @PreAuthorize("hasAnyAuthority('SUPER_ADMIN', 'SYSTEM_ADMIN', 'ORDERS_READ')")
    public ResponseEntity<List<ReporteRepartidorDTO>> reportePorRepartidor(
            @PathVariable UUID branchId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate desde,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate hasta) {
        securityValidationService.validateUserAccessToBranch(branchId);
        return ResponseEntity.ok(repartidorService.reporte(branchId, desde, hasta));
    }

    /**
     * Los grupos de WhatsApp de la sucursal, para elegir el de repartidores de
     * una lista. Viene vacio si el WhatsApp de la sucursal no esta conectado.
     */
    @GetMapping("/branches/{branchId}/whatsapp/groups")
    @PreAuthorize("hasAnyAuthority('SUPER_ADMIN', 'SYSTEM_ADMIN', 'BRANCH_UPDATE')")
    public ResponseEntity<List<Map<String, Object>>> gruposDeWhatsapp(@PathVariable UUID branchId) {
        securityValidationService.validateUserAccessToBranch(branchId);
        return ResponseEntity.ok(whatsappIntegrationService.listGroups(branchId.toString()));
    }

    // ------------------------------------------------------------------
    // Configuracion (panel)
    // ------------------------------------------------------------------

    @GetMapping("/branches/{branchId}/delivery-settings")
    @PreAuthorize("hasAnyAuthority('SUPER_ADMIN', 'SYSTEM_ADMIN', 'ORDERS_READ')")
    public ResponseEntity<DeliverySettingsDTO> obtenerConfiguracion(@PathVariable UUID branchId) {
        securityValidationService.validateUserAccessToBranch(branchId);
        return ResponseEntity.ok(deliveryService.obtenerConfiguracion(branchId));
    }

    @PutMapping("/branches/{branchId}/delivery-settings")
    @PreAuthorize("hasAnyAuthority('SUPER_ADMIN', 'SYSTEM_ADMIN', 'BRANCH_UPDATE')")
    public ResponseEntity<DeliverySettingsDTO> guardarConfiguracion(
            @PathVariable UUID branchId,
            @Valid @RequestBody DeliverySettingsDTO request) {
        securityValidationService.validateUserAccessToBranch(branchId);
        return ResponseEntity.ok(deliveryService.guardarConfiguracion(branchId, request));
    }
}
