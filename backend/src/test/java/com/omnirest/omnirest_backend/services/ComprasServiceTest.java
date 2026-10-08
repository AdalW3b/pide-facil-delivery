package com.omnirest.omnirest_backend.services;

import com.omnirest.omnirest_backend.domain.entities.*;
import com.omnirest.omnirest_backend.domain.enums.TipoMovimiento;
import com.omnirest.omnirest_backend.dtos.ComprasDTOs;
import com.omnirest.omnirest_backend.repositories.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** Compras: IVA, presentaciones, pago con caja y anulación. */
class ComprasServiceTest {

    private final UUID branchId = UUID.randomUUID();
    private final Restaurant restaurante = Restaurant.builder().id(UUID.randomUUID()).name("JA TechCode").build();

    private final BranchRepository branches = mock(BranchRepository.class);
    private final ProveedorRepository proveedores = mock(ProveedorRepository.class);
    private final PresentacionCompraRepository presentaciones = mock(PresentacionCompraRepository.class);
    private final CompraRepository compras = mock(CompraRepository.class);
    private final IngredientRepository ingredientes = mock(IngredientRepository.class);
    private final ProductRepository productos = mock(ProductRepository.class);
    private final MovimientoInventarioRepository movimientos = mock(MovimientoInventarioRepository.class);
    private final InventoryService inventario = mock(InventoryService.class);
    private final CajaService caja = mock(CajaService.class);

    private ComprasService servicio;
    private Ingredient arrachera;
    private Product coca;
    private Proveedor lopez;

    @BeforeEach
    void setUp() {
        servicio = new ComprasService(branches, proveedores, presentaciones, compras, ingredientes, productos, movimientos, inventario, caja);
        when(branches.findById(branchId)).thenReturn(Optional.of(Branch.builder().id(branchId).restaurant(restaurante).build()));
        arrachera = Ingredient.builder().id(UUID.randomUUID()).name("Arrachera").unitOfMeasure("kg").restaurant(restaurante).build();
        when(ingredientes.findById(arrachera.getId())).thenReturn(Optional.of(arrachera));
        Category bebidas = Category.builder().id(UUID.randomUUID()).restaurant(restaurante).name("Bebidas").build();
        coca = Product.builder().id(UUID.randomUUID()).name("Coca-Cola 355 ml").category(bebidas).trackStock(true).build();
        when(productos.findById(coca.getId())).thenReturn(Optional.of(coca));
        lopez = Proveedor.builder().id(UUID.randomUUID()).restaurantId(restaurante.getId()).nombre("Carnicería López").diasCredito(7).build();
        when(proveedores.findById(lopez.getId())).thenReturn(Optional.of(lopez));
        when(compras.save(any(Compra.class))).thenAnswer(i -> {
            Compra c = i.getArgument(0);
            if (c.getId() == null) c.setId(UUID.randomUUID());
            return c;
        });
    }

    private ComprasDTOs.NuevaCompra compra(String pago, String iva, ComprasDTOs.RenglonCompra... renglones) {
        return new ComprasDTOs.NuevaCompra(lopez.getId(), null, "A-2381", null, pago, iva, null, List.of(renglones));
    }

    private ComprasDTOs.RenglonCompra kg(String cantidad, String importe) {
        return new ComprasDTOs.RenglonCompra(arrachera.getId(), null, new BigDecimal(cantidad), "kg", null, new BigDecimal(importe));
    }

    @Test
    @DisplayName("IVA incluido, aparte o sin IVA")
    void totales() {
        var incluido = ComprasService.totales(new BigDecimal("1160"), "INCLUIDO");
        assertEquals(new BigDecimal("1000.00"), incluido.subtotal());
        assertEquals(new BigDecimal("160.00"), incluido.iva());
        assertEquals(new BigDecimal("1160.00"), incluido.total());
        var aparte = ComprasService.totales(new BigDecimal("1000"), "APARTE");
        assertEquals(new BigDecimal("1160.00"), aparte.total());
        assertEquals(new BigDecimal("1000.00"), ComprasService.totales(new BigDecimal("1000"), "SIN").total());
    }

    @Test
    @DisplayName("Con IVA incluido, al inventario entra el costo sin IVA y de la caja sale el total")
    void ivaIncluidoYCaja() {
        when(caja.salidaPorCompra(eq(branchId), any(), anyString(), any())).thenReturn(UUID.randomUUID());

        servicio.registrar(branchId, compra("CAJA", "INCLUIDO", kg("5", "1160")));

        // $1,160 con IVA = $1,000 sin IVA: $200 el kg.
        verify(inventario).moverIngrediente(eq(branchId), eq(arrachera), eq(new BigDecimal("5")), eq(TipoMovimiento.ENTRADA),
                eq(false), anyString(), eq(new BigDecimal("200.0000")), eq("Carnicería López"), any());
        verify(caja).salidaPorCompra(eq(branchId), eq(new BigDecimal("1160.00")), contains("nota A-2381"), any());
    }

    @Test
    @DisplayName("Con efectivo de caja y la caja cerrada, no se registra nada")
    void cajaCerrada() {
        when(caja.salidaPorCompra(any(), any(), anyString(), any()))
                .thenThrow(new IllegalStateException("La caja está cerrada: ábrela en Caja para pagar con efectivo."));
        assertThrows(IllegalStateException.class, () -> servicio.registrar(branchId, compra("CAJA", "SIN", kg("5", "950"))));
        verify(inventario, never()).moverIngrediente(any(), any(), any(), any(), anyBoolean(), any(), any(), any(), any());
    }

    @Test
    @DisplayName("Dos cajas de 24 entran como 48 piezas")
    void presentacion() {
        PresentacionCompra caja24 = PresentacionCompra.builder().id(UUID.randomUUID()).productId(coca.getId())
                .nombre("caja de 24").factor(new BigDecimal("24")).build();
        when(presentaciones.findById(caja24.getId())).thenReturn(Optional.of(caja24));

        servicio.registrar(branchId, compra("TRANSFERENCIA", "SIN",
                new ComprasDTOs.RenglonCompra(null, coca.getId(), new BigDecimal("2"), null, caja24.getId(), new BigDecimal("624"))));

        verify(inventario).moverProducto(eq(branchId), eq(coca), eq(48), eq(TipoMovimiento.ENTRADA), eq(false), anyString(),
                eq(new BigDecimal("13.0000")), any());
        verify(caja, never()).salidaPorCompra(any(), any(), any(), any());
        ArgumentCaptor<Compra> guardada = ArgumentCaptor.forClass(Compra.class);
        verify(compras, atLeastOnce()).save(guardada.capture());
        assertEquals("2 caja de 24 Coca-Cola 355 ml", guardada.getValue().getDetalle());
    }

    @Test
    @DisplayName("A crédito vence según los días del proveedor y no toca la caja")
    void credito() {
        servicio.registrar(branchId, compra("CREDITO", "SIN", kg("1", "190")));
        ArgumentCaptor<Compra> guardada = ArgumentCaptor.forClass(Compra.class);
        verify(compras, atLeastOnce()).save(guardada.capture());
        assertEquals(Combos.hoy().plusDays(7), guardada.getValue().getVence());
        assertNull(guardada.getValue().getPagadaEn());
        verify(caja, never()).salidaPorCompra(any(), any(), any(), any());
    }

    @Test
    @DisplayName("La fecha de la nota no puede ser futura")
    void fechaFutura() {
        var futura = new ComprasDTOs.NuevaCompra(lopez.getId(), null, null, LocalDate.now().plusDays(3), "TRANSFERENCIA", "SIN", null, List.of(kg("1", "190")));
        assertThrows(IllegalArgumentException.class, () -> servicio.registrar(branchId, futura));
    }

    @Test
    @DisplayName("Anular saca del inventario lo que entró y regresa el efectivo a la caja")
    void anular() {
        UUID compraId = UUID.randomUUID();
        Compra c = Compra.builder().id(compraId).branchId(branchId).proveedor("Carnicería López").folio("A-2381")
                .formaPago("CAJA").total(new BigDecimal("950.00")).movimientoCajaId(UUID.randomUUID()).build();
        when(compras.findById(compraId)).thenReturn(Optional.of(c));
        when(movimientos.findByGrupoIdIn(List.of(compraId))).thenReturn(List.of(MovimientoInventario.builder()
                .branchId(branchId).ingredientId(arrachera.getId()).tipo(TipoMovimiento.ENTRADA)
                .cantidad(new BigDecimal("5")).saldo(new BigDecimal("5")).grupoId(compraId).build()));

        servicio.anular(branchId, compraId, "se capturó dos veces");

        verify(inventario).moverIngrediente(eq(branchId), eq(arrachera), eq(new BigDecimal("-5")), eq(TipoMovimiento.ENTRADA),
                eq(false), contains("Compra anulada"), isNull(), isNull(), eq(compraId));
        verify(caja).entradaPorCompraAnulada(eq(branchId), eq(new BigDecimal("950.00")), contains("Compra anulada"), any());
        assertNotNull(c.getAnuladaEn());
        assertThrows(IllegalStateException.class, () -> servicio.anular(branchId, compraId, null), "no se anula dos veces");
    }
}
