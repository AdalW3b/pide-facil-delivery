package com.omnirest.omnirest_backend.services;

import com.omnirest.omnirest_backend.domain.entities.*;
import com.omnirest.omnirest_backend.domain.enums.TipoMovimiento;
import com.omnirest.omnirest_backend.repositories.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** Cada sucursal lleva su costo; el del restaurante es el promedio de todas. */
class CostoPorSucursalTest {

    private final UUID sucursalA = UUID.randomUUID();
    private final UUID sucursalB = UUID.randomUUID();

    private final BranchIngredientStockRepository stocks = mock(BranchIngredientStockRepository.class);
    private final IngredientRepository ingredientes = mock(IngredientRepository.class);
    private InventoryService inventario;
    private Ingredient carne;

    @BeforeEach
    void setUp() {
        inventario = new InventoryService(stocks, mock(BranchProductStockRepository.class), mock(RecipeItemRepository.class),
                mock(BranchRepository.class), ingredientes, mock(ProductRepository.class),
                mock(MovimientoInventarioRepository.class), mock(ProductoAgotadoRepository.class),
                mock(SimpMessagingTemplate.class));
        // El restaurante: 100 kg a $100, todos en la sucursal B.
        carne = Ingredient.builder().id(UUID.randomUUID()).name("Carne").unitOfMeasure("kg")
                .costoPromedio(new BigDecimal("100")).build();
        when(stocks.addStockAtomic(any(), any(), any())).thenReturn(1);
    }

    @Test
    @DisplayName("Una compra en la sucursal A no le cambia el costo a la B")
    void compraNoPisaOtraSucursal() {
        when(stocks.saldo(sucursalA, carne.getId())).thenReturn(Optional.of(new BigDecimal("10")));
        when(stocks.costo(sucursalA, carne.getId())).thenReturn(Optional.empty());
        when(stocks.totalEnSucursales(carne.getId())).thenReturn(new BigDecimal("110"));

        inventario.moverIngrediente(sucursalA, carne, new BigDecimal("10"), TipoMovimiento.ENTRADA, false,
                "Compra", new BigDecimal("150"), null, null);

        // A no tenia nada: su costo es lo que pago.
        verify(stocks).fijarCosto(sucursalA, carne.getId(), new BigDecimal("150.0000"));
        verify(stocks, never()).fijarCosto(eq(sucursalB), any(), any());
        // El restaurante: (100 kg × $100 + 10 kg × $150) / 110 kg.
        assertEquals(new BigDecimal("104.5455"), carne.getCostoPromedio());
    }

    @Test
    @DisplayName("La sucursal promedia con lo que ya tenía a su propio costo")
    void promedioDeLaSucursal() {
        when(stocks.saldo(sucursalB, carne.getId())).thenReturn(Optional.of(new BigDecimal("110")));
        when(stocks.costo(sucursalB, carne.getId())).thenReturn(Optional.of(new BigDecimal("100")));
        when(stocks.totalEnSucursales(carne.getId())).thenReturn(new BigDecimal("110"));

        inventario.moverIngrediente(sucursalB, carne, new BigDecimal("10"), TipoMovimiento.ENTRADA, false,
                "Compra", new BigDecimal("150"), null, null);

        verify(stocks).fijarCosto(sucursalB, carne.getId(), new BigDecimal("104.5455"));
    }

    @Test
    @DisplayName("Un traspaso llega con su costo pero no mueve el costo del restaurante")
    void traspaso() {
        when(stocks.saldo(sucursalA, carne.getId())).thenReturn(Optional.of(new BigDecimal("5")));
        when(stocks.costo(sucursalA, carne.getId())).thenReturn(Optional.empty());

        inventario.moverIngrediente(sucursalA, carne, new BigDecimal("5"), TipoMovimiento.TRANSFERENCIA, false,
                "De B", new BigDecimal("100"), null, null);

        verify(stocks).fijarCosto(sucursalA, carne.getId(), new BigDecimal("100.0000"));
        verify(stocks, never()).totalEnSucursales(any());
        assertEquals(new BigDecimal("100"), carne.getCostoPromedio());
    }

    @Test
    @DisplayName("El platillo se costea con lo de la sucursal y, lo que no tiene, con el general")
    void platilloConCostoDeSucursal() {
        Ingredient tortilla = Ingredient.builder().id(UUID.randomUUID()).name("Tortilla").unitOfMeasure("pieza")
                .costoPromedio(new BigDecimal("1")).build();
        Product taco = Product.builder().id(UUID.randomUUID()).name("Taco").isRecipe(true).build();
        List<RecipeItem> receta = List.of(
                RecipeItem.builder().ingredient(carne).quantity(new BigDecimal("100")).recipeUnit("g").build(),
                RecipeItem.builder().ingredient(tortilla).quantity(new BigDecimal("2")).recipeUnit("pieza").build());

        // General: 0.1 kg × $100 + 2 × $1 = $12.
        assertEquals(new BigDecimal("12.00"), Costos.dePlatillo(taco, receta).valor());
        // En A la carne cuesta $150 y la tortilla no tiene costo propio: 0.1 × 150 + 2 × 1 = $17.
        Costos.Precios deA = Costos.deSucursal(Map.of(carne.getId(), new BigDecimal("150")), Map.of());
        assertEquals(new BigDecimal("17.00"), Costos.dePlatillo(taco, receta, deA).valor());
    }

    @Test
    @DisplayName("Una preparación se costea con los ingredientes de la sucursal")
    void preparacionConCostoDeSucursal() {
        Ingredient tomatillo = Ingredient.builder().id(UUID.randomUUID()).name("Tomatillo").unitOfMeasure("kg")
                .costoPromedio(new BigDecimal("20")).build();
        Ingredient salsa = Ingredient.builder().id(UUID.randomUUID()).name("Salsa verde").unitOfMeasure("l")
                .esPreparado(true).rinde(new BigDecimal("2")).build();
        salsa.getComponentes().add(PreparacionComponente.builder().preparado(salsa).componente(tomatillo)
                .cantidad(new BigDecimal("1")).unidad("kg").build());

        assertEquals(new BigDecimal("10.0000"), Costos.deIngrediente(salsa));
        Costos.Precios caro = Costos.deSucursal(Map.of(tomatillo.getId(), new BigDecimal("30")), Map.of());
        assertEquals(new BigDecimal("15.0000"), Costos.deIngrediente(salsa, caro));
    }
}
