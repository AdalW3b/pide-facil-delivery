package com.omnirest.omnirest_backend.services;

import com.omnirest.omnirest_backend.domain.entities.*;
import com.omnirest.omnirest_backend.domain.enums.ControlInventario;
import com.omnirest.omnirest_backend.domain.enums.TipoMovimiento;
import com.omnirest.omnirest_backend.repositories.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** Una salsa que se prepara sola cuando se vende mas de la registrada. */
class PrepararAlVenderTest {

    private final UUID sucursal = UUID.randomUUID();
    private final BranchIngredientStockRepository stocks = mock(BranchIngredientStockRepository.class);
    private final BranchRepository sucursales = mock(BranchRepository.class);
    private final MovimientoInventarioRepository movimientos = mock(MovimientoInventarioRepository.class);
    private InventoryService inventario;

    private Ingredient tomatillo;
    private Ingredient salsa;
    private Product enchiladas;

    @BeforeEach
    void setUp() {
        inventario = new InventoryService(stocks, mock(BranchProductStockRepository.class), mock(RecipeItemRepository.class),
                sucursales, mock(IngredientRepository.class), mock(ProductRepository.class), movimientos,
                mock(ProductoAgotadoRepository.class), mock(SimpMessagingTemplate.class));
        tomatillo = Ingredient.builder().id(UUID.randomUUID()).name("Tomatillo").unitOfMeasure("kg")
                .costoPromedio(new BigDecimal("20")).build();
        // Una tanda: 1 kg de tomatillo rinde 2 l de salsa.
        salsa = Ingredient.builder().id(UUID.randomUUID()).name("Salsa verde").unitOfMeasure("l")
                .esPreparado(true).prepararAlVender(true).rinde(new BigDecimal("2")).build();
        salsa.getComponentes().add(PreparacionComponente.builder().preparado(salsa).componente(tomatillo)
                .cantidad(new BigDecimal("1")).unidad("kg").build());
        enchiladas = Product.builder().id(UUID.randomUUID()).name("Enchiladas verdes").isRecipe(true).build();
        enchiladas.setRecipeItems(List.of(RecipeItem.builder().ingredient(salsa)
                .quantity(new BigDecimal("250")).recipeUnit("ml").build()));

        when(stocks.addStockAtomic(any(), any(), any())).thenReturn(1);
        when(stocks.subtractStockAtomic(any(), any(), any())).thenReturn(1);
        when(stocks.saldo(any(), any())).thenReturn(Optional.of(BigDecimal.ZERO));
        when(stocks.costo(any(), any())).thenReturn(Optional.empty());
        when(stocks.totalEnSucursales(any())).thenReturn(BigDecimal.ONE);
    }

    /** El mismo numero aunque venga con otra escala (0.50 = 0.5). */
    private static BigDecimal num(String valor) {
        BigDecimal esperado = new BigDecimal(valor);
        return argThat(x -> x != null && x.compareTo(esperado) == 0);
    }

    @Test
    @DisplayName("Sin salsa registrada, se prepara lo que falta: sale el tomatillo y entra la salsa")
    void preparaLoQueFalta() {
        inventario.checkAndDeductStock(enchiladas, sucursal, 2); // 2 × 250 ml = 0.5 l

        // 0.5 l son un cuarto de tanda: 0.25 kg de tomatillo.
        verify(stocks).subtractStockAtomic(eq(sucursal), eq(tomatillo.getId()), num("0.250"));
        verify(stocks).addStockAtomic(eq(sucursal), eq(salsa.getId()), num("0.5"));
        verify(stocks).subtractStockAtomic(eq(sucursal), eq(salsa.getId()), num("0.5"));

        ArgumentCaptor<MovimientoInventario> m = ArgumentCaptor.forClass(MovimientoInventario.class);
        verify(movimientos, times(3)).save(m.capture());
        assertEquals(List.of(TipoMovimiento.PRODUCCION, TipoMovimiento.PRODUCCION, TipoMovimiento.VENTA),
                m.getAllValues().stream().map(MovimientoInventario::getTipo).toList());
        assertTrue(m.getAllValues().get(0).getNota().startsWith("Preparación automática"));
        // La salsa entra con su costo: 0.25 kg × $20 / 0.5 l = $10 el litro.
        assertEquals(new BigDecimal("10.0000"), m.getAllValues().get(1).getCostoUnitario());
    }

    @Test
    @DisplayName("Si la salsa registrada alcanza, no se prepara nada")
    void siAlcanzaNoPrepara() {
        when(stocks.saldo(sucursal, salsa.getId())).thenReturn(Optional.of(new BigDecimal("3")));

        inventario.checkAndDeductStock(enchiladas, sucursal, 2);

        verify(stocks, never()).subtractStockAtomic(eq(sucursal), eq(tomatillo.getId()), any());
        verify(stocks).subtractStockAtomic(eq(sucursal), eq(salsa.getId()), num("0.5"));
    }

    @Test
    @DisplayName("Sin la opción, la salsa queda en negativo como antes")
    void sinLaOpcion() {
        salsa.setPrepararAlVender(false);
        when(stocks.subtractStockAtomic(eq(sucursal), eq(salsa.getId()), num("0.5"))).thenReturn(0);

        inventario.checkAndDeductStock(enchiladas, sucursal, 2);

        verify(stocks, never()).subtractStockAtomic(eq(sucursal), eq(tomatillo.getId()), any());
        verify(stocks).addStockAtomic(eq(sucursal), eq(salsa.getId()), num("-0.5"));
    }

    @Test
    @DisplayName("En modo Bloquear, sin tomatillo no se vende")
    void bloquearSinIngredientes() {
        when(sucursales.findById(sucursal)).thenReturn(Optional.of(
                Branch.builder().id(sucursal).controlInventario(ControlInventario.BLOQUEAR).build()));
        when(stocks.subtractStockAtomic(eq(sucursal), eq(tomatillo.getId()), num("0.250"))).thenReturn(0);

        IllegalStateException e = assertThrows(IllegalStateException.class,
                () -> inventario.checkAndDeductStock(enchiladas, sucursal, 2));
        assertEquals("No alcanza Tomatillo para preparar Salsa verde.", e.getMessage());
    }

    @Test
    @DisplayName("Lo disponible cuenta lo que se puede preparar")
    void disponible() {
        // 1.5 kg de tomatillo = 1.5 tandas = 3 l, más 0.2 l registrados.
        Map<UUID, BigDecimal> existencias = Map.of(tomatillo.getId(), new BigDecimal("1.5"), salsa.getId(), new BigDecimal("0.2"));
        assertEquals(0, new BigDecimal("3.2").compareTo(Disponible.de(salsa, existencias)));

        salsa.setPrepararAlVender(false);
        assertEquals(0, new BigDecimal("0.2").compareTo(Disponible.de(salsa, existencias)));
    }
}
