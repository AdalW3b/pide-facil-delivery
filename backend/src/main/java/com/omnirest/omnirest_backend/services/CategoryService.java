package com.omnirest.omnirest_backend.services;

import com.omnirest.omnirest_backend.domain.entities.Category;
import com.omnirest.omnirest_backend.domain.entities.Restaurant;
import com.omnirest.omnirest_backend.dtos.CategoryRequestDTO;
import com.omnirest.omnirest_backend.dtos.CategoryResponseDTO;
import com.omnirest.omnirest_backend.repositories.CategoryRepository;
import com.omnirest.omnirest_backend.repositories.RestaurantRepository;
import com.omnirest.omnirest_backend.security.CustomUserDetails;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class CategoryService {

    private final CategoryRepository categoryRepository;
    private final RestaurantRepository restaurantRepository;

    public List<CategoryResponseDTO> getCategories(CustomUserDetails user) {
        UUID restaurantId = user.restaurantId();

        boolean isDemo = restaurantId != null && restaurantRepository.findById(restaurantId)
                .map(r -> Boolean.TRUE.equals(r.getIsDemo()))
                .orElse(false);

        if (isDemo) {
            restaurantId = restaurantRepository.findAll().stream()
                    .filter(r -> Boolean.TRUE.equals(r.getIsDemo()))
                    .map(Restaurant::getId)
                    .findFirst()
                    .orElse(user.restaurantId());
        }

        return categoryRepository.findByRestaurantId(restaurantId).stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    public CategoryResponseDTO getCategoryById(UUID id, CustomUserDetails user) {
        Category category = categoryRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Category not found"));

        validateRestaurantOwnership(user, category.getRestaurant().getId());

        return mapToResponse(category);
    }

    @Transactional
    public CategoryResponseDTO createCategory(CategoryRequestDTO dto, CustomUserDetails user) {
        UUID restaurantId = user.restaurantId();
        Restaurant restaurant = restaurantRepository.findById(restaurantId)
                .orElseThrow(() -> new IllegalArgumentException("Restaurant not found"));

        Category category = Category.builder()
                .restaurant(restaurant)
                .name(dto.name())
                .active(dto.active() != null ? dto.active() : true)
                .build();

        return mapToResponse(categoryRepository.save(category));
    }

    @Transactional
    public CategoryResponseDTO updateCategory(UUID id, CategoryRequestDTO dto, CustomUserDetails user) {
        Category category = categoryRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Category not found"));

        validateRestaurantOwnership(user, category.getRestaurant().getId());

        category.setName(dto.name());
        if (dto.active() != null) {
            category.setActive(dto.active());
        }

        return mapToResponse(categoryRepository.save(category));
    }

    @Transactional
    public void deleteCategory(UUID id, CustomUserDetails user) {
        Category category = categoryRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Category not found"));

        validateRestaurantOwnership(user, category.getRestaurant().getId());
        categoryRepository.delete(category);
    }

    private void validateRestaurantOwnership(CustomUserDetails user, UUID resourceRestaurantId) {
        if (user.restaurantId() == null || !user.restaurantId().equals(resourceRestaurantId)) {
            throw new AccessDeniedException("User does not have access to this restaurant's categories");
        }
    }

    private CategoryResponseDTO mapToResponse(Category category) {
        return new CategoryResponseDTO(
                category.getId(),
                category.getRestaurant().getId(),
                category.getName(),
                category.getActive());
    }
}
