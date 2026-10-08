package com.omnirest.omnirest_backend.controllers;

import com.omnirest.omnirest_backend.dtos.ComprasDTOs;
import com.omnirest.omnirest_backend.services.ComprasService;
import com.omnirest.omnirest_backend.services.PedidosProveedorService;
import com.omnirest.omnirest_backend.services.SecurityValidationService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Compras de una sucursal, sus proveedores y las presentaciones en que se compra. */
@RestController
@RequestMapping("/api/v1/branches/{branchId}/inventario")
@RequiredArgsConstructor
public class ComprasController {

    private final ComprasService compras;
    private final PedidosProveedorService pedidos;
    private final SecurityValidationService seguridad;

    // ------------------------------------------------------------------ proveedores

    @GetMapping("/proveedores")
    @PreAuthorize("hasAnyAuthority('INVENTORY_READ', 'CATALOG_READ')")
    public ResponseEntity<List<ComprasDTOs.Proveedor>> proveedores(@PathVariable UUID branchId) {
        seguridad.validateUserAccessToBranch(branchId);
        return ResponseEntity.ok(compras.proveedores(branchId));
    }

    @PostMapping("/proveedores")
    @PreAuthorize("hasAnyAuthority('INVENTORY_UPDATE', 'CATALOG_UPDATE')")
    public ResponseEntity<ComprasDTOs.Proveedor> crearProveedor(@PathVariable UUID branchId,
                                                                @Valid @RequestBody ComprasDTOs.GuardarProveedor datos) {
        seguridad.validateUserAccessToBranch(branchId);
        return ResponseEntity.ok(compras.guardarProveedor(branchId, null, datos));
    }

    @PutMapping("/proveedores/{id}")
    @PreAuthorize("hasAnyAuthority('INVENTORY_UPDATE', 'CATALOG_UPDATE')")
    public ResponseEntity<ComprasDTOs.Proveedor> editarProveedor(@PathVariable UUID branchId, @PathVariable UUID id,
                                                                 @Valid @RequestBody ComprasDTOs.GuardarProveedor datos) {
        seguridad.validateUserAccessToBranch(branchId);
        return ResponseEntity.ok(compras.guardarProveedor(branchId, id, datos));
    }

    @PatchMapping("/proveedores/{id}/activo")
    @PreAuthorize("hasAnyAuthority('INVENTORY_UPDATE', 'CATALOG_UPDATE')")
    public ResponseEntity<Void> activarProveedor(@PathVariable UUID branchId, @PathVariable UUID id,
                                                 @RequestBody Map<String, Boolean> cuerpo) {
        seguridad.validateUserAccessToBranch(branchId);
        compras.activarProveedor(branchId, id, Boolean.TRUE.equals(cuerpo.get("activo")));
        return ResponseEntity.noContent().build();
    }

    // ------------------------------------------------------------------ presentaciones

    @GetMapping("/presentaciones")
    @PreAuthorize("hasAnyAuthority('INVENTORY_READ', 'CATALOG_READ')")
    public ResponseEntity<List<ComprasDTOs.Presentacion>> presentaciones(@PathVariable UUID branchId) {
        seguridad.validateUserAccessToBranch(branchId);
        return ResponseEntity.ok(compras.presentaciones(branchId));
    }

    @PostMapping("/presentaciones")
    @PreAuthorize("hasAnyAuthority('INVENTORY_UPDATE', 'CATALOG_UPDATE')")
    public ResponseEntity<ComprasDTOs.Presentacion> crearPresentacion(@PathVariable UUID branchId,
                                                                      @Valid @RequestBody ComprasDTOs.NuevaPresentacion datos) {
        seguridad.validateUserAccessToBranch(branchId);
        return ResponseEntity.ok(compras.crearPresentacion(branchId, datos));
    }

    @DeleteMapping("/presentaciones/{id}")
    @PreAuthorize("hasAnyAuthority('INVENTORY_UPDATE', 'CATALOG_UPDATE')")
    public ResponseEntity<Void> borrarPresentacion(@PathVariable UUID branchId, @PathVariable UUID id) {
        seguridad.validateUserAccessToBranch(branchId);
        compras.borrarPresentacion(branchId, id);
        return ResponseEntity.noContent().build();
    }

    /** Lo último que se pagó por cada artículo: la pantalla avisa si subió. */
    @GetMapping("/ultimos-precios")
    @PreAuthorize("hasAnyAuthority('INVENTORY_READ', 'CATALOG_READ')")
    public ResponseEntity<List<ComprasDTOs.UltimoPrecio>> ultimosPrecios(@PathVariable UUID branchId) {
        seguridad.validateUserAccessToBranch(branchId);
        return ResponseEntity.ok(compras.ultimosPrecios(branchId));
    }

    // ------------------------------------------------------------------ compras

    @PostMapping("/compras")
    @PreAuthorize("hasAnyAuthority('INVENTORY_UPDATE', 'CATALOG_UPDATE')")
    public ResponseEntity<ComprasDTOs.Resultado> registrar(@PathVariable UUID branchId,
                                                           @Valid @RequestBody ComprasDTOs.NuevaCompra compra) {
        seguridad.validateUserAccessToBranch(branchId);
        return ResponseEntity.ok(compras.registrar(branchId, compra));
    }

    @GetMapping("/compras")
    @PreAuthorize("hasAnyAuthority('INVENTORY_READ', 'CATALOG_READ')")
    public ResponseEntity<List<ComprasDTOs.Compra>> compras(@PathVariable UUID branchId) {
        seguridad.validateUserAccessToBranch(branchId);
        return ResponseEntity.ok(compras.compras(branchId));
    }

    @PostMapping("/compras/{id}/anular")
    @PreAuthorize("hasAnyAuthority('INVENTORY_UPDATE', 'CATALOG_UPDATE')")
    public ResponseEntity<ComprasDTOs.Resultado> anular(@PathVariable UUID branchId, @PathVariable UUID id,
                                                        @Valid @RequestBody(required = false) ComprasDTOs.Anular datos) {
        seguridad.validateUserAccessToBranch(branchId);
        return ResponseEntity.ok(compras.anular(branchId, id, datos != null ? datos.motivo() : null));
    }

    /** Lo comprado a credito que falta pagar. */
    @GetMapping("/compras/por-pagar")
    @PreAuthorize("hasAnyAuthority('INVENTORY_READ', 'CATALOG_READ')")
    public ResponseEntity<List<ComprasDTOs.Compra>> porPagar(@PathVariable UUID branchId) {
        seguridad.validateUserAccessToBranch(branchId);
        return ResponseEntity.ok(compras.porPagar(branchId));
    }

    @PostMapping("/compras/pagar")
    @PreAuthorize("hasAnyAuthority('INVENTORY_UPDATE', 'CATALOG_UPDATE')")
    public ResponseEntity<ComprasDTOs.Resultado> pagar(@PathVariable UUID branchId, @Valid @RequestBody ComprasDTOs.Pagar datos) {
        seguridad.validateUserAccessToBranch(branchId);
        return ResponseEntity.ok(compras.pagar(branchId, datos));
    }

    // ------------------------------------------------------------------ pedidos al proveedor

    @GetMapping("/pedidos/sugerencias")
    @PreAuthorize("hasAnyAuthority('INVENTORY_READ', 'CATALOG_READ')")
    public ResponseEntity<List<ComprasDTOs.Sugerido>> sugerencias(@PathVariable UUID branchId) {
        seguridad.validateUserAccessToBranch(branchId);
        return ResponseEntity.ok(pedidos.sugerencias(branchId));
    }

    @GetMapping("/pedidos")
    @PreAuthorize("hasAnyAuthority('INVENTORY_READ', 'CATALOG_READ')")
    public ResponseEntity<List<ComprasDTOs.Pedido>> pedidos(@PathVariable UUID branchId) {
        seguridad.validateUserAccessToBranch(branchId);
        return ResponseEntity.ok(pedidos.pedidos(branchId));
    }

    @PostMapping("/pedidos")
    @PreAuthorize("hasAnyAuthority('INVENTORY_UPDATE', 'CATALOG_UPDATE')")
    public ResponseEntity<ComprasDTOs.Pedido> crearPedido(@PathVariable UUID branchId, @Valid @RequestBody ComprasDTOs.NuevoPedido datos) {
        seguridad.validateUserAccessToBranch(branchId);
        return ResponseEntity.ok(pedidos.crear(branchId, datos));
    }

    @PostMapping("/pedidos/{id}/cancelar")
    @PreAuthorize("hasAnyAuthority('INVENTORY_UPDATE', 'CATALOG_UPDATE')")
    public ResponseEntity<ComprasDTOs.Resultado> cancelarPedido(@PathVariable UUID branchId, @PathVariable UUID id) {
        seguridad.validateUserAccessToBranch(branchId);
        return ResponseEntity.ok(pedidos.cancelar(branchId, id));
    }
}
