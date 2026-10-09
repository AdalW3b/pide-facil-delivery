package com.omnirest.omnirest_backend.services;

import com.omnirest.omnirest_backend.domain.entities.*;
import com.omnirest.omnirest_backend.dtos.ComprasDTOs;
import com.omnirest.omnirest_backend.repositories.BranchRepository;
import com.omnirest.omnirest_backend.repositories.PedidoProveedorRepository;
import com.omnirest.omnirest_backend.repositories.ProveedorRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** El pedido al proveedor sale por el WhatsApp de la sucursal, como al repartidor. */
class PedidosProveedorServiceTest {

    private final UUID branchId = UUID.randomUUID();
    private final Restaurant restaurante = Restaurant.builder().id(UUID.randomUUID()).name("JA TechCode").build();
    private final Branch sucursal = Branch.builder().id(branchId).name("Centro").restaurant(restaurante).build();

    private final BranchRepository branches = mock(BranchRepository.class);
    private final ProveedorRepository proveedores = mock(ProveedorRepository.class);
    private final PedidoProveedorRepository pedidos = mock(PedidoProveedorRepository.class);
    private final ComprasService compras = mock(ComprasService.class);
    private final OperacionesInventarioService operaciones = mock(OperacionesInventarioService.class);
    private final ColaWhatsapp cola = mock(ColaWhatsapp.class);
    private PedidosProveedorService servicio;
    private Ingredient arrachera;

    @BeforeEach
    void setUp() {
        servicio = new PedidosProveedorService(branches, proveedores, pedidos, compras, operaciones, cola);
        when(branches.findById(branchId)).thenReturn(Optional.of(sucursal));
        arrachera = Ingredient.builder().id(UUID.randomUUID()).name("Arrachera").unitOfMeasure("kg").restaurant(restaurante).build();
        when(compras.ingrediente(arrachera.getId(), restaurante.getId())).thenReturn(arrachera);
        when(pedidos.save(any(PedidoProveedor.class))).thenAnswer(i -> {
            PedidoProveedor p = i.getArgument(0);
            if (p.getId() == null) p.setId(UUID.randomUUID());
            return p;
        });
    }

    private Proveedor proveedor(String telefono) {
        Proveedor p = Proveedor.builder().id(UUID.randomUUID()).restaurantId(restaurante.getId())
                .nombre("Carnicería López").telefono(telefono).build();
        when(compras.proveedor(p.getId(), restaurante.getId())).thenReturn(p);
        when(proveedores.findById(p.getId())).thenReturn(Optional.of(p));
        return p;
    }

    private ComprasDTOs.NuevoPedido pedidoA(Proveedor p) {
        return new ComprasDTOs.NuevoPedido(p.getId(), Combos.hoy().plusDays(1), null,
                List.of(new ComprasDTOs.RenglonPedido(arrachera.getId(), null, new BigDecimal("10"), "kg", null)));
    }

    @Test
    @DisplayName("Con WhatsApp, el pedido le llega solo al proveedor desde la sucursal")
    void seMandaSolo() {
        Proveedor lopez = proveedor("951 123 4567");

        ComprasDTOs.Pedido creado = servicio.crear(branchId, pedidoA(lopez));

        ArgumentCaptor<String> texto = ArgumentCaptor.forClass(String.class);
        verify(cola).encolar(eq(branchId), eq("529511234567"), texto.capture(),
                eq(MensajeWhatsapp.Motivo.PEDIDO_PROVEEDOR), startsWith("proveedor:"));
        assertTrue(texto.getValue().contains("1. *10 kg* · Arrachera"), texto.getValue());
        assertNotNull(creado.enviadoEn());
        assertEquals("529511234567", creado.enviadoA());
    }

    @Test
    @DisplayName("Sin WhatsApp se guarda igual y no se manda; reenviar pide capturarlo")
    void sinWhatsapp() {
        Proveedor lopez = proveedor(null);

        ComprasDTOs.Pedido creado = servicio.crear(branchId, pedidoA(lopez));

        verify(cola, never()).encolar(any(), any(), any(), any(), any());
        assertNull(creado.enviadoEn());
        PedidoProveedor guardado = PedidoProveedor.builder().id(creado.id()).branchId(branchId)
                .proveedorId(lopez.getId()).proveedor(lopez.getNombre()).build();
        when(pedidos.findById(creado.id())).thenReturn(Optional.of(guardado));
        IllegalArgumentException e = assertThrows(IllegalArgumentException.class, () -> servicio.enviar(branchId, creado.id()));
        assertTrue(e.getMessage().contains("Proveedores"));
    }

    @Test
    @DisplayName("Cancelar un pedido que ya se le mandó le avisa al proveedor")
    void cancelarAvisa() {
        PedidoProveedor p = PedidoProveedor.builder().id(UUID.randomUUID()).branchId(branchId).proveedor("López")
                .enviadoA("529511234567").build();
        when(pedidos.findById(p.getId())).thenReturn(Optional.of(p));

        servicio.cancelar(branchId, p.getId());

        assertEquals(PedidoProveedor.CANCELADO, p.getEstado());
        verify(cola).encolar(eq(branchId), eq("529511234567"), contains("cancelar"), any(), any());
    }
}
