package com.omnirest.omnirest_backend.controllers;

import com.omnirest.omnirest_backend.dtos.InventarioDTOs;
import com.omnirest.omnirest_backend.security.CustomUserDetails;
import com.omnirest.omnirest_backend.services.AgotadosService;
import com.omnirest.omnirest_backend.services.InventoryService;
import com.omnirest.omnirest_backend.services.MovimientosService;
import com.omnirest.omnirest_backend.services.SecurityValidationService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

/** Inventario de una sucursal: modo de control, movimientos e historial, y agotados. */
@RestController
@RequestMapping("/api/v1/branches/{branchId}")
@RequiredArgsConstructor
public class InventarioController {

    private final InventoryService inventoryService;
    private final MovimientosService movimientosService;
    private final AgotadosService agotadosService;
    private final SecurityValidationService securityValidationService;
    private final com.omnirest.omnirest_backend.services.OperacionesInventarioService operaciones;

    @GetMapping("/inventario/config")
    @PreAuthorize("hasAnyAuthority('INVENTORY_READ', 'CATALOG_READ')")
    public ResponseEntity<InventarioDTOs.Config> config(@PathVariable UUID branchId) {
        securityValidationService.validateUserAccessToBranch(branchId);
        return ResponseEntity.ok(new InventarioDTOs.Config(inventoryService.modo(branchId)));
    }

    @PutMapping("/inventario/config")
    @PreAuthorize("hasAnyAuthority('INVENTORY_UPDATE', 'CATALOG_UPDATE')")
    public ResponseEntity<InventarioDTOs.Config> cambiarConfig(
            @PathVariable UUID branchId, @Valid @RequestBody InventarioDTOs.Config config) {
        securityValidationService.validateUserAccessToBranch(branchId);
        return ResponseEntity.ok(new InventarioDTOs.Config(inventoryService.cambiarModo(branchId, config.modo())));
    }

    /** Entrada de mercancia, merma o conteo fisico. */
    @PostMapping("/inventario/movimientos")
    @PreAuthorize("hasAnyAuthority('INVENTORY_UPDATE', 'CATALOG_UPDATE')")
    public ResponseEntity<InventarioDTOs.Resultado> registrar(
            @PathVariable UUID branchId, @Valid @RequestBody InventarioDTOs.NuevoMovimiento movimiento) {
        securityValidationService.validateUserAccessToBranch(branchId);
        return ResponseEntity.ok(movimientosService.registrar(branchId, movimiento));
    }

    /** Los ultimos 100 movimientos de un ingrediente o de un producto. */
    @GetMapping("/inventario/movimientos")
    @PreAuthorize("hasAnyAuthority('INVENTORY_READ', 'CATALOG_READ')")
    public ResponseEntity<List<InventarioDTOs.Movimiento>> historial(
            @PathVariable UUID branchId,
            @RequestParam(required = false) UUID ingredientId,
            @RequestParam(required = false) UUID productId) {
        securityValidationService.validateUserAccessToBranch(branchId);
        if ((ingredientId == null) == (productId == null)) {
            throw new IllegalArgumentException("Indica un ingrediente o un producto.");
        }
        return ResponseEntity.ok(movimientosService.historial(branchId, ingredientId, productId));
    }

    // ------------------------------------------------------------------
    // Pantalla de Inventario
    // ------------------------------------------------------------------

    /** Ingredientes y productos terminados en una sola lista. */
    @GetMapping("/inventario/existencias")
    @PreAuthorize("hasAnyAuthority('INVENTORY_READ', 'CATALOG_READ')")
    public ResponseEntity<List<com.omnirest.omnirest_backend.dtos.OperacionesInventarioDTOs.Articulo>> existencias(
            @PathVariable UUID branchId) {
        securityValidationService.validateUserAccessToBranch(branchId);
        return ResponseEntity.ok(operaciones.existencias(branchId));
    }

    /** Minimo, zona y costo de un ingrediente o producto. */
    @PutMapping("/inventario/articulos/{tipo}/{id}")
    @PreAuthorize("hasAnyAuthority('INVENTORY_UPDATE', 'CATALOG_UPDATE')")
    public ResponseEntity<Void> actualizarArticulo(
            @PathVariable UUID branchId, @PathVariable String tipo, @PathVariable UUID id,
            @Valid @RequestBody com.omnirest.omnirest_backend.dtos.OperacionesInventarioDTOs.ActualizarArticulo datos) {
        securityValidationService.validateUserAccessToBranch(branchId);
        operaciones.actualizar(branchId, tipo.toUpperCase(), id, datos);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/inventario/zonas")
    @PreAuthorize("hasAnyAuthority('INVENTORY_READ', 'CATALOG_READ')")
    public ResponseEntity<List<com.omnirest.omnirest_backend.dtos.OperacionesInventarioDTOs.Zona>> zonas(@PathVariable UUID branchId) {
        securityValidationService.validateUserAccessToBranch(branchId);
        return ResponseEntity.ok(operaciones.zonas(branchId));
    }

    @PostMapping("/inventario/zonas")
    @PreAuthorize("hasAnyAuthority('INVENTORY_UPDATE', 'CATALOG_UPDATE')")
    public ResponseEntity<com.omnirest.omnirest_backend.dtos.OperacionesInventarioDTOs.Zona> crearZona(
            @PathVariable UUID branchId,
            @Valid @RequestBody com.omnirest.omnirest_backend.dtos.OperacionesInventarioDTOs.NuevaZona datos) {
        securityValidationService.validateUserAccessToBranch(branchId);
        return ResponseEntity.ok(operaciones.crearZona(branchId, datos));
    }

    @PutMapping("/inventario/zonas/{zonaId}")
    @PreAuthorize("hasAnyAuthority('INVENTORY_UPDATE', 'CATALOG_UPDATE')")
    public ResponseEntity<com.omnirest.omnirest_backend.dtos.OperacionesInventarioDTOs.Zona> renombrarZona(
            @PathVariable UUID branchId, @PathVariable UUID zonaId,
            @Valid @RequestBody com.omnirest.omnirest_backend.dtos.OperacionesInventarioDTOs.NuevaZona datos) {
        securityValidationService.validateUserAccessToBranch(branchId);
        return ResponseEntity.ok(operaciones.renombrarZona(branchId, zonaId, datos));
    }

    @DeleteMapping("/inventario/zonas/{zonaId}")
    @PreAuthorize("hasAnyAuthority('INVENTORY_UPDATE', 'CATALOG_UPDATE')")
    public ResponseEntity<Void> borrarZona(@PathVariable UUID branchId, @PathVariable UUID zonaId) {
        securityValidationService.validateUserAccessToBranch(branchId);
        operaciones.borrarZona(branchId, zonaId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/inventario/compras")
    @PreAuthorize("hasAnyAuthority('INVENTORY_UPDATE', 'CATALOG_UPDATE')")
    public ResponseEntity<com.omnirest.omnirest_backend.dtos.OperacionesInventarioDTOs.Lote> registrarCompra(
            @PathVariable UUID branchId,
            @Valid @RequestBody com.omnirest.omnirest_backend.dtos.OperacionesInventarioDTOs.NuevaCompra compra) {
        securityValidationService.validateUserAccessToBranch(branchId);
        return ResponseEntity.ok(operaciones.registrarCompra(branchId, compra));
    }

    @GetMapping("/inventario/compras")
    @PreAuthorize("hasAnyAuthority('INVENTORY_READ', 'CATALOG_READ')")
    public ResponseEntity<List<com.omnirest.omnirest_backend.dtos.OperacionesInventarioDTOs.CompraHecha>> compras(
            @PathVariable UUID branchId) {
        securityValidationService.validateUserAccessToBranch(branchId);
        return ResponseEntity.ok(operaciones.compras(branchId));
    }

    @PostMapping("/inventario/conteos")
    @PreAuthorize("hasAnyAuthority('INVENTORY_UPDATE', 'CATALOG_UPDATE')")
    public ResponseEntity<com.omnirest.omnirest_backend.dtos.OperacionesInventarioDTOs.Lote> registrarConteo(
            @PathVariable UUID branchId,
            @Valid @RequestBody com.omnirest.omnirest_backend.dtos.OperacionesInventarioDTOs.NuevoConteo conteo) {
        securityValidationService.validateUserAccessToBranch(branchId);
        return ResponseEntity.ok(operaciones.registrarConteo(branchId, conteo));
    }

    @PostMapping("/inventario/transferencias")
    @PreAuthorize("hasAnyAuthority('INVENTORY_UPDATE', 'CATALOG_UPDATE')")
    public ResponseEntity<com.omnirest.omnirest_backend.dtos.OperacionesInventarioDTOs.Lote> transferir(
            @PathVariable UUID branchId,
            @Valid @RequestBody com.omnirest.omnirest_backend.dtos.OperacionesInventarioDTOs.NuevaTransferencia t) {
        securityValidationService.validateUserAccessToBranch(branchId);
        return ResponseEntity.ok(operaciones.transferir(branchId, t));
    }

    @GetMapping("/inventario/preparaciones")
    @PreAuthorize("hasAnyAuthority('INVENTORY_READ', 'CATALOG_READ')")
    public ResponseEntity<List<com.omnirest.omnirest_backend.dtos.OperacionesInventarioDTOs.Preparacion>> preparaciones(
            @PathVariable UUID branchId) {
        securityValidationService.validateUserAccessToBranch(branchId);
        return ResponseEntity.ok(operaciones.preparaciones(branchId));
    }

    @PutMapping("/inventario/preparaciones/{preparadoId}")
    @PreAuthorize("hasAnyAuthority('INVENTORY_UPDATE', 'CATALOG_UPDATE')")
    public ResponseEntity<com.omnirest.omnirest_backend.dtos.OperacionesInventarioDTOs.Preparacion> guardarPreparacion(
            @PathVariable UUID branchId, @PathVariable UUID preparadoId,
            @Valid @RequestBody com.omnirest.omnirest_backend.dtos.OperacionesInventarioDTOs.Preparacion datos) {
        securityValidationService.validateUserAccessToBranch(branchId);
        return ResponseEntity.ok(operaciones.guardarPreparacion(branchId, preparadoId, datos));
    }

    @DeleteMapping("/inventario/preparaciones/{preparadoId}")
    @PreAuthorize("hasAnyAuthority('INVENTORY_UPDATE', 'CATALOG_UPDATE')")
    public ResponseEntity<Void> quitarPreparacion(@PathVariable UUID branchId, @PathVariable UUID preparadoId) {
        securityValidationService.validateUserAccessToBranch(branchId);
        operaciones.quitarPreparacion(branchId, preparadoId);
        return ResponseEntity.noContent().build();
    }

    /** "Hice 3 l de salsa": salen sus ingredientes y entra lo preparado. */
    @PostMapping("/inventario/producir")
    @PreAuthorize("hasAnyAuthority('INVENTORY_UPDATE', 'CATALOG_UPDATE')")
    public ResponseEntity<com.omnirest.omnirest_backend.dtos.OperacionesInventarioDTOs.Lote> producir(
            @PathVariable UUID branchId,
            @Valid @RequestBody com.omnirest.omnirest_backend.dtos.OperacionesInventarioDTOs.Producir orden) {
        securityValidationService.validateUserAccessToBranch(branchId);
        return ResponseEntity.ok(operaciones.producir(branchId, orden));
    }

    /** Consumo, merma, costo y sugerencia de compra; sin fechas, los ultimos 7 dias. */
    @GetMapping("/inventario/reporte")
    @PreAuthorize("hasAnyAuthority('INVENTORY_READ', 'CATALOG_READ')")
    public ResponseEntity<com.omnirest.omnirest_backend.dtos.OperacionesInventarioDTOs.Reporte> reporte(
            @PathVariable UUID branchId,
            @RequestParam(required = false) @org.springframework.format.annotation.DateTimeFormat(iso = org.springframework.format.annotation.DateTimeFormat.ISO.DATE) java.time.LocalDate desde,
            @RequestParam(required = false) @org.springframework.format.annotation.DateTimeFormat(iso = org.springframework.format.annotation.DateTimeFormat.ISO.DATE) java.time.LocalDate hasta) {
        securityValidationService.validarCosteoDeSucursal(branchId);
        return ResponseEntity.ok(operaciones.reporte(branchId, desde, hasta));
    }

    // ------------------------------------------------------------------
    // Agotados ("se acabó")
    // ------------------------------------------------------------------

    /** Lo que no se puede pedir hoy: marcado a mano o sin existencias. */
    @GetMapping("/agotados")
    @PreAuthorize("hasAnyAuthority('CATALOG_READ', 'KITCHEN_READ', 'KITCHEN_UPDATE')")
    public ResponseEntity<List<AgotadosService.Agotado>> agotados(@PathVariable UUID branchId) {
        securityValidationService.validateUserAccessToBranch(branchId);
        return ResponseEntity.ok(agotadosService.lista(branchId));
    }

    @PostMapping("/products/{productId}/agotado")
    @PreAuthorize("hasAnyAuthority('CATALOG_UPDATE', 'KITCHEN_UPDATE')")
    public ResponseEntity<Void> marcarAgotado(
            @PathVariable UUID branchId, @PathVariable UUID productId,
            @AuthenticationPrincipal CustomUserDetails usuario) {
        securityValidationService.validateUserAccessToBranch(branchId);
        agotadosService.marcar(branchId, productId, usuario != null ? usuario.getUsername() : null);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/products/{productId}/agotado")
    @PreAuthorize("hasAnyAuthority('CATALOG_UPDATE', 'KITCHEN_UPDATE')")
    public ResponseEntity<Void> quitarAgotado(@PathVariable UUID branchId, @PathVariable UUID productId) {
        securityValidationService.validateUserAccessToBranch(branchId);
        agotadosService.quitar(branchId, productId);
        return ResponseEntity.noContent().build();
    }
}
