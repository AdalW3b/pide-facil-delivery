package com.omnirest.omnirest_backend.services;

import com.omnirest.omnirest_backend.domain.entities.*;
import com.omnirest.omnirest_backend.repositories.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class InventoryServiceTest {

    @Mock
    private BranchIngredientStockRepository branchIngredientStockRepository;

    @Mock
    private BranchProductStockRepository branchProductStockRepository;

    @Mock
    private RecipeItemRepository recipeItemRepository;

    @Mock
    private BranchRepository branchRepository;

    @Mock
    private IngredientRepository ingredientRepository;

    @Mock
    private ProductRepository productRepository;

    @InjectMocks
    private InventoryService inventoryService;

    private UUID branchId;
    private Product recipeProduct;
    private Product directProduct;
    private Ingredient carne;
    private Ingredient queso;
    private RecipeItem itemCarne;
    private RecipeItem itemQueso;

    @BeforeEach
    void setUp() {
        branchId = UUID.randomUUID();

        carne = Ingredient.builder()
                .id(UUID.randomUUID())
                .name("Carne Molida")
                .unitOfMeasure("kg")
                .build();

        queso = Ingredient.builder()
                .id(UUID.randomUUID())
                .name("Queso Cheddar")
                .unitOfMeasure("kg")
                .build();

        itemCarne = RecipeItem.builder()
                .id(UUID.randomUUID())
                .ingredient(carne)
                .quantity(new BigDecimal("200"))
                .recipeUnit("g")
                .build();

        itemQueso = RecipeItem.builder()
                .id(UUID.randomUUID())
                .ingredient(queso)
                .quantity(new BigDecimal("50"))
                .recipeUnit("g")
                .build();

        recipeProduct = Product.builder()
                .id(UUID.randomUUID())
                .name("Burger Doble")
                .isRecipe(true)
                .recipeItems(List.of(itemCarne, itemQueso))
                .build();

        directProduct = Product.builder()
                .id(UUID.randomUUID())
                .name("Refresco Lata")
                .isRecipe(false)
                .trackStock(true)
                .build();
    }

    @Test
    @DisplayName("checkAndDeductStock for recipe product invokes subtractStockAtomic per ingredient")
    void checkAndDeductStock_RecipeProduct_CallsSubtractStockAtomicForEachIngredient() {
        // Mock successful deduction (1 row updated)
        when(branchIngredientStockRepository.subtractStockAtomic(eq(branchId), eq(carne.getId()), any(BigDecimal.class)))
                .thenReturn(1);
        when(branchIngredientStockRepository.subtractStockAtomic(eq(branchId), eq(queso.getId()), any(BigDecimal.class)))
                .thenReturn(1);

        // 2 units sold -> carne: 200g * 2 = 400g = 0.4000kg, queso: 50g * 2 = 100g = 0.1000kg
        inventoryService.checkAndDeductStock(recipeProduct, branchId, 2);

        verify(branchIngredientStockRepository, times(1))
                .subtractStockAtomic(eq(branchId), eq(carne.getId()), argThat(v -> v.compareTo(new BigDecimal("0.4")) == 0));
        verify(branchIngredientStockRepository, times(1))
                .subtractStockAtomic(eq(branchId), eq(queso.getId()), argThat(v -> v.compareTo(new BigDecimal("0.1")) == 0));
        verifyNoInteractions(branchProductStockRepository);
    }

    @Test
    @DisplayName("checkAndDeductStock throws IllegalStateException when subtractStockAtomic returns 0 (insufficient stock)")
    void checkAndDeductStock_RecipeProduct_InsufficientStock_ThrowsIllegalStateException() {
        when(branchIngredientStockRepository.subtractStockAtomic(eq(branchId), eq(carne.getId()), any(BigDecimal.class)))
                .thenReturn(0);

        IllegalStateException ex = assertThrows(
                IllegalStateException.class,
                () -> inventoryService.checkAndDeductStock(recipeProduct, branchId, 1)
        );

        assertTrue(ex.getMessage().contains("Stock insuficiente del ingrediente: Carne Molida"));
    }

    @Test
    @DisplayName("checkAndDeductStock for direct product with trackStock invokes branchProductStockRepository")
    void checkAndDeductStock_DirectProduct_CallsProductSubtractStockAtomic() {
        when(branchProductStockRepository.subtractStockAtomic(eq(branchId), eq(directProduct.getId()), eq(3)))
                .thenReturn(1);

        inventoryService.checkAndDeductStock(directProduct, branchId, 3);

        verify(branchProductStockRepository, times(1))
                .subtractStockAtomic(eq(branchId), eq(directProduct.getId()), eq(3));
        verifyNoInteractions(branchIngredientStockRepository);
    }
}
