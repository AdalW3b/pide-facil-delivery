package com.omnirest.omnirest_backend.services;

import com.omnirest.omnirest_backend.domain.entities.*;
import com.omnirest.omnirest_backend.dtos.ComboItemDTO;
import com.omnirest.omnirest_backend.dtos.ProductRequestDTO;
import com.omnirest.omnirest_backend.dtos.ProductResponseDTO;
import com.omnirest.omnirest_backend.repositories.*;
import com.omnirest.omnirest_backend.security.CustomUserDetails;
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

/**
 * Combos y paquetes de promocion: se arman con platillos del menu, venden lo
 * de sus platillos y solo se venden en los dias de su promocion.
 */
class CombosTest {

    private final UUID restaurantId = UUID.randomUUID();
    private final UUID branchId = UUID.randomUUID();

    private final Restaurant restaurante = Restaurant.builder().id(restaurantId).name("Prueba").build();
    private final Category categoria = Category.builder().id(UUID.randomUUID()).name("Combos").restaurant(restaurante).build();
    private final Ingredient carne = Ingredient.builder()
            .id(UUID.randomUUID()).name("Pastor").unitOfMeasure("kg").restaurant(restaurante).build();

    private Product taco;
    private Product refresco;

    private final CategoryRepository categoryRepository = mock(CategoryRepository.class);
    private final ProductRepository productRepository = mock(ProductRepository.class);
    private final BranchIngredientStockRepository ingredientes = mock(BranchIngredientStockRepository.class);
    private final BranchProductStockRepository existencias = mock(BranchProductStockRepository.class);
    private final ComboItemRepository comboItemRepository = mock(ComboItemRepository.class);
    private final IngredientRepository ingredientRepository = mock(IngredientRepository.class);

    @BeforeEach
    void menu() {
        taco = Product.builder().id(UUID.randomUUID()).name("Taco al pastor").price(new BigDecimal("25"))
                .category(categoria).active(true).isRecipe(true).build();
        taco.getRecipeItems().add(RecipeItem.builder().product(taco).ingredient(carne)
                .quantity(new BigDecimal("100")).recipeUnit("g").build());
        refresco = Product.builder().id(UUID.randomUUID()).name("Refresco").price(new BigDecimal("30"))
                .category(categoria).active(true).trackStock(true).build();

        when(categoryRepository.findById(categoria.getId())).thenReturn(Optional.of(categoria));
        when(ingredientRepository.findById(carne.getId())).thenReturn(Optional.of(carne));
        when(productRepository.findById(taco.getId())).thenReturn(Optional.of(taco));
        when(productRepository.findById(refresco.getId())).thenReturn(Optional.of(refresco));
        when(productRepository.save(any(Product.class))).thenAnswer(i -> {
            Product p = i.getArgument(0);
            if (p.getId() == null) p.setId(UUID.randomUUID());
            return p;
        });
    }

    private ProductService productService() {
        return new ProductService(productRepository, categoryRepository, mock(IngredientRepository.class),
                mock(RecipeItemRepository.class), existencias, ingredientes,
                mock(BranchRepository.class), mock(RestaurantRepository.class), comboItemRepository,
                mock(InventoryService.class), mock(AgotadosService.class));
    }

    private InventoryService inventoryService() {
        return new InventoryService(ingredientes, existencias, mock(RecipeItemRepository.class),
                mock(BranchRepository.class), ingredientRepository, productRepository,
                mock(MovimientoInventarioRepository.class), mock(ProductoAgotadoRepository.class),
                mock(org.springframework.messaging.simp.SimpMessagingTemplate.class));
    }

    private CustomUserDetails usuario() {
        return new CustomUserDetails(UUID.randomUUID(), "gerente", "x", "SUPER_ADMIN", "/", restaurantId, branchId, List.of());
    }

    private ProductRequestDTO combo(List<ComboItemDTO> partes, LocalDate desde, LocalDate hasta, List<Integer> dias) {
        return new ProductRequestDTO(categoria.getId(), "Combo pareja", new BigDecimal("140"), null, true,
                false, null, false, null, true, partes, desde, hasta, dias);
    }

    private static ComboItemDTO parte(Product p, int cantidad) {
        return new ComboItemDTO(p.getId(), cantidad, null, null, null);
    }

    private Product guardado() {
        ArgumentCaptor<Product> captor = ArgumentCaptor.forClass(Product.class);
        verify(productRepository).save(captor.capture());
        return captor.getValue();
    }

    @Test
    @DisplayName("Un combo guarda sus platillos, su ahorro y cuántos alcanzan en la sucursal")
    void armarCombo() {
        ProductResponseDTO r = productService().createProduct(
                combo(List.of(parte(taco, 4), parte(refresco, 2)), null, null, null), usuario());

        assertTrue(r.isCombo());
        assertEquals(2, r.comboItems().size());
        assertEquals("Taco al pastor", r.comboItems().get(0).nombre());
        assertEquals(0, r.precioNormal().compareTo(new BigDecimal("160")), "4 × 25 + 2 × 30");
        assertNull(r.vigencia());
        assertTrue(r.vigenteHoy());

        // Hay 1 kg de pastor (10 tacos) y 3 refrescos: alcanzan 1 combo (3 / 2).
        Product combo = guardado();
        when(ingredientes.findByBranchId(branchId)).thenReturn(List.of(BranchIngredientStock.builder()
                .id(new BranchIngredientStockKey(branchId, carne.getId())).stock(new BigDecimal("1")).build()));
        when(existencias.findByBranchIdAndProductId(branchId, refresco.getId()))
                .thenReturn(Optional.of(BranchProductStock.builder().stock(3).build()));
        when(productRepository.findByCategoryRestaurantId(restaurantId)).thenReturn(List.of(combo));
        assertEquals(1, productService().getProducts(usuario(), branchId).get(0).stock());
    }

    @Test
    @DisplayName("El mismo platillo dos veces se suma en un renglón")
    void platilloRepetidoSeSuma() {
        productService().createProduct(combo(List.of(parte(taco, 2), parte(taco, 1), parte(refresco, 1)), null, null, null), usuario());
        Product combo = guardado();
        assertEquals(2, combo.getComboItems().size());
        assertEquals(3, combo.getComboItems().get(0).getCantidad());
    }

    @Test
    @DisplayName("Un combo no puede llevar otro combo, ni un solo platillo")
    void reglasDelCombo() {
        Product otroCombo = Product.builder().id(UUID.randomUUID()).name("Combo familiar").price(BigDecimal.TEN)
                .category(categoria).active(true).isCombo(true).build();
        when(productRepository.findById(otroCombo.getId())).thenReturn(Optional.of(otroCombo));

        IllegalArgumentException anidado = assertThrows(IllegalArgumentException.class, () -> productService()
                .createProduct(combo(List.of(parte(otroCombo, 1), parte(taco, 1)), null, null, null), usuario()));
        assertTrue(anidado.getMessage().contains("ya es un combo"), anidado.getMessage());

        assertThrows(IllegalArgumentException.class, () -> productService()
                .createProduct(combo(List.of(parte(taco, 1)), null, null, null), usuario()));
        assertThrows(IllegalArgumentException.class, () -> productService()
                .createProduct(combo(List.of(), null, null, null), usuario()));
    }

    @Test
    @DisplayName("Fechas al revés se rechazan")
    void fechasAlReves() {
        assertThrows(IllegalArgumentException.class, () -> productService().createProduct(
                combo(List.of(parte(taco, 2)), LocalDate.of(2026, 10, 31), LocalDate.of(2026, 10, 1), null), usuario()));
    }

    @Test
    @DisplayName("Un platillo que va en un combo no se puede borrar")
    void noSeBorraUnPlatilloDeUnCombo() {
        Product combo = Product.builder().id(UUID.randomUUID()).name("Combo pareja").build();
        when(comboItemRepository.findByProductoId(taco.getId()))
                .thenReturn(List.of(ComboItem.builder().combo(combo).producto(taco).cantidad(4).build()));

        IllegalArgumentException error = assertThrows(IllegalArgumentException.class,
                () -> productService().deleteProduct(taco.getId(), usuario()));
        assertTrue(error.getMessage().contains("Combo pareja"), error.getMessage());
        verify(productRepository, never()).delete(any());
    }

    @Test
    @DisplayName("Vender 2 combos descuenta 8 tacos y 4 refrescos; cancelar los devuelve")
    void venderYCancelar() {
        productService().createProduct(combo(List.of(parte(taco, 4), parte(refresco, 2)), null, null, null), usuario());
        Product combo = guardado();
        when(ingredientes.subtractStockAtomic(any(), any(), any())).thenReturn(1);
        when(existencias.subtractStockAtomic(any(), any(), anyInt())).thenReturn(1);
        when(ingredientes.addStockAtomic(any(), any(), any())).thenReturn(1);
        when(existencias.addStockAtomic(any(), any(), anyInt())).thenReturn(1);

        OrderItem linea = OrderItem.builder().product(combo).quantity(2).unitPrice(combo.getPrice()).build();
        inventoryService().venderLinea(linea, branchId);

        ArgumentCaptor<BigDecimal> kilos = ArgumentCaptor.forClass(BigDecimal.class);
        verify(ingredientes).subtractStockAtomic(eq(branchId), eq(carne.getId()), kilos.capture());
        assertEquals(0, kilos.getValue().compareTo(new BigDecimal("0.8")), "8 tacos × 100 g");
        verify(existencias).subtractStockAtomic(branchId, refresco.getId(), 4);

        assertEquals(List.of("Incluye: 4 × Taco al pastor, 2 × Refresco"), linea.adicionalesParaMostrar());

        // Se cambia el combo despues de vender: la cancelacion devuelve lo vendido.
        combo.getComboItems().clear();
        inventoryService().devolverLinea(linea, branchId);
        verify(ingredientes).addStockAtomic(eq(branchId), eq(carne.getId()), argThat(k -> k.compareTo(new BigDecimal("0.8")) == 0));
        verify(existencias).addStockAtomic(branchId, refresco.getId(), 4);
    }

    @Test
    @DisplayName("Un combo con un platillo desactivado no se vende")
    void platilloDesactivado() {
        productService().createProduct(combo(List.of(parte(taco, 4), parte(refresco, 2)), null, null, null), usuario());
        Product combo = guardado();
        refresco.setActive(false);

        IllegalStateException error = assertThrows(IllegalStateException.class, () -> inventoryService()
                .venderLinea(OrderItem.builder().product(combo).quantity(1).build(), branchId));
        assertTrue(error.getMessage().contains("Refresco"), error.getMessage());
    }

    @Test
    @DisplayName("La promoción solo se vende en sus días y fechas")
    void vigencia() {
        Product promo = Product.builder().name("Martes de tacos").isCombo(true)
                .promoDias(Combos.diasParaGuardar(List.of(4, 2, 2)))
                .promoDesde(LocalDate.of(2026, 10, 1)).promoHasta(LocalDate.of(2026, 10, 31)).build();

        assertEquals("2,4", promo.getPromoDias());
        assertTrue(Combos.vigente(promo, LocalDate.of(2026, 10, 6)), "martes 6 oct");
        assertTrue(Combos.vigente(promo, LocalDate.of(2026, 10, 8)), "jueves 8 oct");
        assertFalse(Combos.vigente(promo, LocalDate.of(2026, 10, 7)), "miércoles");
        assertFalse(Combos.vigente(promo, LocalDate.of(2026, 9, 29)), "martes, pero antes de empezar");
        assertFalse(Combos.vigente(promo, LocalDate.of(2026, 11, 3)), "martes, pero ya terminó");
        assertEquals("martes y jueves, del 1 oct al 31 oct", Combos.textoVigencia(promo).replace(".", ""));

        assertNull(Combos.diasParaGuardar(List.of(1, 2, 3, 4, 5, 6, 7)), "todos los días = sin límite");
        assertThrows(IllegalArgumentException.class, () -> Combos.diasParaGuardar(List.of(8)));
    }

    @Test
    @DisplayName("Fuera de su día, el combo no se deja vender")
    void fueraDeSuDia() {
        productService().createProduct(combo(List.of(parte(taco, 2)), null, Combos.hoy().minusDays(1), null), usuario());
        Product combo = guardado();

        IllegalStateException error = assertThrows(IllegalStateException.class, () -> inventoryService()
                .venderLinea(OrderItem.builder().product(combo).quantity(1).build(), branchId));
        assertTrue(error.getMessage().contains("no está disponible hoy"), error.getMessage());
        verifyNoInteractions(ingredientes);
    }
}
