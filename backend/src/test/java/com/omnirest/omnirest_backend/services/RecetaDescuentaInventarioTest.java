package com.omnirest.omnirest_backend.services;

import com.omnirest.omnirest_backend.domain.entities.*;
import com.omnirest.omnirest_backend.dtos.ProductRequestDTO;
import com.omnirest.omnirest_backend.dtos.RecipeItemDTO;
import com.omnirest.omnirest_backend.repositories.*;
import com.omnirest.omnirest_backend.security.CustomUserDetails;
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

/**
 * El camino completo: una receta guardada desde el panel ("250 g" de un
 * ingrediente que se lleva en kg) y la venta de un platillo. Antes la
 * cantidad se convertia al guardar y otra vez al vender, y el inventario
 * bajaba 0.00025 kg en vez de 0.25 kg.
 */
class RecetaDescuentaInventarioTest {

    private final UUID restaurantId = UUID.randomUUID();
    private final UUID branchId = UUID.randomUUID();

    private final Restaurant restaurante = Restaurant.builder().id(restaurantId).name("Prueba").build();
    private final Category categoria = Category.builder().id(UUID.randomUUID()).name("Tacos").restaurant(restaurante).build();
    private final Ingredient carne = Ingredient.builder()
            .id(UUID.randomUUID()).name("Carne de suadero").unitOfMeasure("kg").restaurant(restaurante).build();

    private final CategoryRepository categoryRepository = mock(CategoryRepository.class);
    private final ProductRepository productRepository = mock(ProductRepository.class);
    private final IngredientRepository ingredientRepository = mock(IngredientRepository.class);
    private final BranchIngredientStockRepository stockRepository = mock(BranchIngredientStockRepository.class);

    private ProductService productService() {
        return new ProductService(productRepository, categoryRepository, ingredientRepository,
                mock(RecipeItemRepository.class), mock(BranchProductStockRepository.class), stockRepository,
                mock(BranchRepository.class), mock(RestaurantRepository.class), mock(ComboItemRepository.class),
                mock(InventoryService.class), mock(AgotadosService.class));
    }

    private InventoryService inventoryService() {
        return new InventoryService(stockRepository, mock(BranchProductStockRepository.class),
                mock(RecipeItemRepository.class), mock(BranchRepository.class), ingredientRepository, productRepository,
                mock(MovimientoInventarioRepository.class), mock(ProductoAgotadoRepository.class),
                mock(org.springframework.messaging.simp.SimpMessagingTemplate.class));
    }

    private CustomUserDetails usuario() {
        return new CustomUserDetails(UUID.randomUUID(), "gerente", "x", "SUPER_ADMIN", "/", restaurantId, branchId, List.of());
    }

    private Product guardarReceta(String cantidad, String unidad) {
        when(categoryRepository.findById(categoria.getId())).thenReturn(Optional.of(categoria));
        when(ingredientRepository.findById(carne.getId())).thenReturn(Optional.of(carne));
        when(productRepository.save(any(Product.class))).thenAnswer(i -> {
            Product p = i.getArgument(0);
            p.setId(UUID.randomUUID());
            return p;
        });
        RecipeItemDTO renglon = new RecipeItemDTO(null, carne.getId(), null, null, unidad,
                new BigDecimal(cantidad), null, null, null);
        productService().createProduct(new ProductRequestDTO(categoria.getId(), "Taco de suadero",
                new BigDecimal("25"), null, true, false, null, true, List.of(renglon)), usuario());

        ArgumentCaptor<Product> guardado = ArgumentCaptor.forClass(Product.class);
        verify(productRepository).save(guardado.capture());
        return guardado.getValue();
    }

    @Test
    @DisplayName("250 g guardados desde el panel descuentan 0.25 kg al vender uno")
    void recetaEnGramosDescuentaKilos() {
        Product taco = guardarReceta("250", "g");

        RecipeItem renglon = taco.getRecipeItems().get(0);
        assertEquals(0, renglon.getQuantity().compareTo(new BigDecimal("250")), "se guarda como se escribió");
        assertEquals("g", renglon.getRecipeUnit());

        when(stockRepository.subtractStockAtomic(any(), any(), any())).thenReturn(1);
        inventoryService().checkAndDeductStock(taco, branchId, 1);

        ArgumentCaptor<BigDecimal> descontado = ArgumentCaptor.forClass(BigDecimal.class);
        verify(stockRepository).subtractStockAtomic(eq(branchId), eq(carne.getId()), descontado.capture());
        assertEquals(0, descontado.getValue().compareTo(new BigDecimal("0.25")), () -> "descontó " + descontado.getValue());
    }

    @Test
    @DisplayName("Una receta en ml de un ingrediente que se lleva en kg no se acepta")
    void unidadIncompatibleSeRechaza() {
        IllegalArgumentException error = assertThrows(IllegalArgumentException.class, () -> guardarReceta("100", "ml"));
        assertTrue(error.getMessage().contains("kg"), error.getMessage());
    }

    @Test
    @DisplayName("No se puede usar un ingrediente de otro restaurante")
    void ingredienteDeOtroRestauranteSeRechaza() {
        carne.setRestaurant(Restaurant.builder().id(UUID.randomUUID()).name("Otro").build());
        assertThrows(IllegalArgumentException.class, () -> guardarReceta("250", "g"));
    }
}
