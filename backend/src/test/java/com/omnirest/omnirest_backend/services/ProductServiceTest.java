package com.omnirest.omnirest_backend.services;

import com.omnirest.omnirest_backend.domain.entities.*;
import com.omnirest.omnirest_backend.dtos.ProductRequestDTO;
import com.omnirest.omnirest_backend.dtos.ProductResponseDTO;
import com.omnirest.omnirest_backend.dtos.RecipeItemDTO;
import com.omnirest.omnirest_backend.repositories.*;
import com.omnirest.omnirest_backend.security.CustomUserDetails;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ProductServiceTest {

    @Mock
    private ProductRepository productRepository;

    @Mock
    private CategoryRepository categoryRepository;

    @Mock
    private IngredientRepository ingredientRepository;

    @Mock
    private RecipeItemRepository recipeItemRepository;

    @Mock
    private BranchProductStockRepository branchProductStockRepository;

    @Mock
    private BranchIngredientStockRepository branchIngredientStockRepository;

    @Mock
    private BranchRepository branchRepository;

    @Mock
    private RestaurantRepository restaurantRepository;

    @InjectMocks
    private ProductService productService;

    private UUID restaurantId;
    private UUID branchId;
    private Category category;
    private Product product;
    private CustomUserDetails user;

    @BeforeEach
    void setUp() {
        restaurantId = UUID.randomUUID();
        branchId = UUID.randomUUID();

        Restaurant restaurant = Restaurant.builder()
                .id(restaurantId)
                .name("Restaurante Test")
                .build();

        category = Category.builder()
                .id(UUID.randomUUID())
                .name("Bebidas")
                .restaurant(restaurant)
                .build();

        product = Product.builder()
                .id(UUID.randomUUID())
                .name("Limonada")
                .price(new BigDecimal("35.00"))
                .category(category)
                .active(true)
                .trackStock(false)
                .isRecipe(false)
                .recipeItems(new ArrayList<>())
                .build();

        user = new CustomUserDetails(
                UUID.randomUUID(), "admin", "pwd", "SUPER_ADMIN", "/admin", restaurantId, null, List.of());
    }

    @Test
    @DisplayName("getProducts returns products for the user's restaurant")
    void getProducts_ReturnsProducts() {
        when(productRepository.findByCategoryRestaurantId(restaurantId)).thenReturn(List.of(product));

        List<ProductResponseDTO> result = productService.getProducts(user, branchId);

        assertNotNull(result);
        assertEquals(1, result.size());
        assertEquals("Limonada", result.get(0).name());
    }

    @Test
    @DisplayName("createProduct creates direct product successfully")
    void createProduct_DirectProduct_Success() {
        ProductRequestDTO request = new ProductRequestDTO(
                category.getId(),
                "Coca Cola",
                new BigDecimal("30.00"),
                "Refresco 600ml",
                true,
                true,
                50,
                false,
                null
        );

        when(categoryRepository.findById(category.getId())).thenReturn(Optional.of(category));
        when(productRepository.save(any(Product.class))).thenAnswer(invocation -> {
            Product p = invocation.getArgument(0);
            p.setId(UUID.randomUUID());
            return p;
        });

        ProductResponseDTO response = productService.createProduct(request, user);

        assertNotNull(response);
        assertEquals("Coca Cola", response.name());
        assertEquals(new BigDecimal("30.00"), response.price());
        verify(productRepository).save(any(Product.class));
    }

    @Test
    @DisplayName("La receta se guarda como se escribe: 250 ml, no 0.25")
    void createProduct_RecipeProduct_GuardaLaCantidadComoSeEscribe() {
        Ingredient ingredient = Ingredient.builder()
                .id(UUID.randomUUID())
                .name("Leche")
                .unitOfMeasure("L")
                .restaurant(category.getRestaurant())
                .build();

        RecipeItemDTO recipeItemDto = new RecipeItemDTO(
                null,
                ingredient.getId(),
                "Leche",
                "L",
                "ml",
                BigDecimal.valueOf(250), // 250 ml
                BigDecimal.valueOf(250),
                null,
                null
        );

        ProductRequestDTO request = new ProductRequestDTO(
                category.getId(),
                "Café con leche",
                new BigDecimal("45.00"),
                "Café latte",
                true,
                false,
                null,
                true,
                List.of(recipeItemDto)
        );

        when(categoryRepository.findById(category.getId())).thenReturn(Optional.of(category));
        when(ingredientRepository.findById(ingredient.getId())).thenReturn(Optional.of(ingredient));
        when(productRepository.save(any(Product.class))).thenAnswer(invocation -> {
            Product p = invocation.getArgument(0);
            p.setId(UUID.randomUUID());
            return p;
        });

        ProductResponseDTO response = productService.createProduct(request, user);

        assertNotNull(response);
        assertEquals("Café con leche", response.name());
        assertTrue(response.isRecipe());
        verify(productRepository).save(argThat(p -> {
            return p.getRecipeItems() != null &&
                   p.getRecipeItems().size() == 1 &&
                   p.getRecipeItems().get(0).getQuantity().compareTo(new BigDecimal("250")) == 0 &&
                   "ml".equals(p.getRecipeItems().get(0).getRecipeUnit());
        }));
    }

    @Test
    @DisplayName("getProductById throws AccessDeniedException if product belongs to another restaurant")
    void getProductById_OtherRestaurant_ThrowsAccessDeniedException() {
        Restaurant otherRestaurant = Restaurant.builder()
                .id(UUID.randomUUID())
                .name("Otro")
                .build();
        Category otherCategory = Category.builder()
                .id(UUID.randomUUID())
                .restaurant(otherRestaurant)
                .build();
        product.setCategory(otherCategory);

        when(productRepository.findById(product.getId())).thenReturn(Optional.of(product));

        assertThrows(AccessDeniedException.class, () ->
                productService.getProductById(product.getId(), user, branchId));
    }
}
