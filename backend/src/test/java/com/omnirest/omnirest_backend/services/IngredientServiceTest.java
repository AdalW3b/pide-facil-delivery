package com.omnirest.omnirest_backend.services;

import com.omnirest.omnirest_backend.domain.entities.Branch;
import com.omnirest.omnirest_backend.domain.entities.Ingredient;
import com.omnirest.omnirest_backend.domain.entities.Restaurant;
import com.omnirest.omnirest_backend.dtos.IngredientDTO;
import com.omnirest.omnirest_backend.repositories.BranchIngredientStockRepository;
import com.omnirest.omnirest_backend.repositories.BranchRepository;
import com.omnirest.omnirest_backend.repositories.IngredientRepository;
import com.omnirest.omnirest_backend.repositories.RestaurantRepository;
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
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class IngredientServiceTest {

    @Mock
    private IngredientRepository ingredientRepository;

    @Mock
    private RestaurantRepository restaurantRepository;

    @Mock
    private BranchIngredientStockRepository branchIngredientStockRepository;

    @Mock
    private BranchRepository branchRepository;

    @InjectMocks
    private IngredientService ingredientService;

    private UUID restaurantId;
    private UUID branchId;
    private Restaurant restaurant;
    private Branch branch;
    private Ingredient ingredient;
    private CustomUserDetails user;

    @BeforeEach
    void setUp() {
        restaurantId = UUID.randomUUID();
        branchId = UUID.randomUUID();

        restaurant = Restaurant.builder()
                .id(restaurantId)
                .name("Restaurante Test")
                .build();

        branch = Branch.builder()
                .id(branchId)
                .restaurant(restaurant)
                .name("Sucursal Test")
                .build();

        ingredient = Ingredient.builder()
                .id(UUID.randomUUID())
                .name("Queso Mozzarella")
                .unitOfMeasure("kg")
                .restaurant(restaurant)
                .active(true)
                .build();

        user = new CustomUserDetails(
                UUID.randomUUID(), "admin", "pwd", "SUPER_ADMIN", "/admin", restaurantId, null, List.of());
    }

    @Test
    @DisplayName("getIngredients returns ingredients for user's restaurant")
    void getIngredients_ReturnsIngredients() {
        when(ingredientRepository.findByRestaurantId(restaurantId)).thenReturn(List.of(ingredient));

        List<IngredientDTO> result = ingredientService.getIngredients(user, null);

        assertNotNull(result);
        assertEquals(1, result.size());
        assertEquals("Queso Mozzarella", result.get(0).name());
    }

    @Test
    @DisplayName("createIngredient creates ingredient successfully")
    void createIngredient_Success_CreatesIngredient() {
        IngredientDTO dto = new IngredientDTO(null, restaurantId, "Jitomate", "kg", null, true);

        when(restaurantRepository.findById(restaurantId)).thenReturn(Optional.of(restaurant));
        when(ingredientRepository.save(any(Ingredient.class))).thenAnswer(invocation -> {
            Ingredient i = invocation.getArgument(0);
            i.setId(UUID.randomUUID());
            return i;
        });

        IngredientDTO response = ingredientService.createIngredient(dto, user);

        assertNotNull(response);
        assertEquals("Jitomate", response.name());
        assertEquals("kg", response.unitOfMeasure());
        verify(ingredientRepository).save(any(Ingredient.class));
    }

    @Test
    @DisplayName("updateStock updates branch ingredient stock")
    void updateStock_Success_UpdatesStock() {
        when(ingredientRepository.findById(ingredient.getId())).thenReturn(Optional.of(ingredient));
        when(branchRepository.findById(branchId)).thenReturn(Optional.of(branch));
        when(branchIngredientStockRepository.findByBranchIdAndIngredientId(branchId, ingredient.getId()))
                .thenReturn(Optional.empty());

        IngredientDTO response = ingredientService.updateStock(ingredient.getId(), branchId, new BigDecimal("15.50"), user);

        assertNotNull(response);
        verify(branchIngredientStockRepository).save(any());
    }

    @Test
    @DisplayName("deleteIngredient throws AccessDeniedException when user does not own restaurant")
    void deleteIngredient_OtherRestaurant_ThrowsAccessDeniedException() {
        UUID otherRestaurantId = UUID.randomUUID();
        CustomUserDetails otherUser = new CustomUserDetails(
                UUID.randomUUID(), "admin2", "pwd", "SUPER_ADMIN", "/admin", otherRestaurantId, null, List.of());

        when(ingredientRepository.findById(ingredient.getId())).thenReturn(Optional.of(ingredient));

        assertThrows(AccessDeniedException.class, () -> ingredientService.deleteIngredient(ingredient.getId(), otherUser));
        verify(ingredientRepository, never()).delete(any());
    }
}
