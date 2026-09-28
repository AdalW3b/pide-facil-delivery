package com.omnirest.omnirest_backend.services;

import com.omnirest.omnirest_backend.domain.entities.Category;
import com.omnirest.omnirest_backend.domain.entities.Restaurant;
import com.omnirest.omnirest_backend.dtos.CategoryRequestDTO;
import com.omnirest.omnirest_backend.dtos.CategoryResponseDTO;
import com.omnirest.omnirest_backend.repositories.CategoryRepository;
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

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class CategoryServiceTest {

    @Mock
    private CategoryRepository categoryRepository;

    @Mock
    private RestaurantRepository restaurantRepository;

    @InjectMocks
    private CategoryService categoryService;

    private UUID restaurantId;
    private Restaurant restaurant;
    private Category category;
    private CustomUserDetails user;

    @BeforeEach
    void setUp() {
        restaurantId = UUID.randomUUID();
        restaurant = Restaurant.builder()
                .id(restaurantId)
                .name("Restaurante Test")
                .build();

        category = Category.builder()
                .id(UUID.randomUUID())
                .restaurant(restaurant)
                .name("Postres")
                .active(true)
                .build();

        user = new CustomUserDetails(
                UUID.randomUUID(), "admin", "pwd", "SUPER_ADMIN", "/admin", restaurantId, null, List.of());
    }

    @Test
    @DisplayName("getCategories returns categories filtered by restaurantId")
    void getCategories_ReturnsCategories() {
        when(categoryRepository.findByRestaurantId(restaurantId)).thenReturn(List.of(category));

        List<CategoryResponseDTO> result = categoryService.getCategories(user);

        assertNotNull(result);
        assertEquals(1, result.size());
        assertEquals("Postres", result.get(0).name());
    }

    @Test
    @DisplayName("createCategory saves category for the authenticated user's restaurant")
    void createCategory_Success_SavesCategory() {
        CategoryRequestDTO request = new CategoryRequestDTO("Entradas", true);

        when(restaurantRepository.findById(restaurantId)).thenReturn(Optional.of(restaurant));
        when(categoryRepository.save(any(Category.class))).thenAnswer(invocation -> {
            Category c = invocation.getArgument(0);
            c.setId(UUID.randomUUID());
            return c;
        });

        CategoryResponseDTO response = categoryService.createCategory(request, user);

        assertNotNull(response);
        assertEquals("Entradas", response.name());
        verify(categoryRepository).save(any(Category.class));
    }

    @Test
    @DisplayName("deleteCategory deletes category successfully when user owns restaurant")
    void deleteCategory_Success_DeletesCategory() {
        when(categoryRepository.findById(category.getId())).thenReturn(Optional.of(category));

        categoryService.deleteCategory(category.getId(), user);

        verify(categoryRepository).delete(category);
    }

    @Test
    @DisplayName("deleteCategory throws AccessDeniedException when category belongs to another restaurant")
    void deleteCategory_OtherRestaurant_ThrowsAccessDeniedException() {
        UUID otherRestaurantId = UUID.randomUUID();
        CustomUserDetails otherUser = new CustomUserDetails(
                UUID.randomUUID(), "admin2", "pwd", "SUPER_ADMIN", "/admin", otherRestaurantId, null, List.of());

        when(categoryRepository.findById(category.getId())).thenReturn(Optional.of(category));

        assertThrows(AccessDeniedException.class, () -> categoryService.deleteCategory(category.getId(), otherUser));
        verify(categoryRepository, never()).delete(any(Category.class));
    }
}
