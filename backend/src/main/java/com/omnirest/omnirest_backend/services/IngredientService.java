package com.omnirest.omnirest_backend.services;

import com.omnirest.omnirest_backend.domain.entities.Branch;
import com.omnirest.omnirest_backend.domain.entities.BranchIngredientStock;
import com.omnirest.omnirest_backend.domain.entities.BranchIngredientStockKey;
import com.omnirest.omnirest_backend.domain.entities.Ingredient;
import com.omnirest.omnirest_backend.domain.entities.Restaurant;
import com.omnirest.omnirest_backend.dtos.IngredientDTO;
import com.omnirest.omnirest_backend.repositories.BranchIngredientStockRepository;
import com.omnirest.omnirest_backend.repositories.BranchRepository;
import com.omnirest.omnirest_backend.repositories.IngredientRepository;
import com.omnirest.omnirest_backend.repositories.RestaurantRepository;
import com.omnirest.omnirest_backend.security.CustomUserDetails;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class IngredientService {

    private final IngredientRepository ingredientRepository;
    private final RestaurantRepository restaurantRepository;
    private final BranchIngredientStockRepository branchIngredientStockRepository;
    private final BranchRepository branchRepository;

    public List<IngredientDTO> getIngredients(CustomUserDetails user, UUID branchId) {
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

        return ingredientRepository.findByRestaurantId(restaurantId).stream()
                .map(i -> mapToDTO(i, branchId))
                .collect(Collectors.toList());
    }

    public IngredientDTO getIngredientById(UUID id, CustomUserDetails user, UUID branchId) {
        Ingredient ingredient = ingredientRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Ingrediente no encontrado: " + id));

        validateRestaurantOwnership(user, ingredient.getRestaurant().getId());

        return mapToDTO(ingredient, branchId);
    }

    @Transactional
    public IngredientDTO createIngredient(IngredientDTO dto, CustomUserDetails user) {
        Restaurant restaurant = restaurantRepository.findById(user.restaurantId())
                .orElseThrow(() -> new IllegalArgumentException("Restaurante no encontrado: " + user.restaurantId()));

        Ingredient ingredient = Ingredient.builder()
                .restaurant(restaurant)
                .name(dto.name())
                .unitOfMeasure(dto.unitOfMeasure())
                .active(dto.active() != null ? dto.active() : true)
                .build();

        return mapToDTO(ingredientRepository.save(ingredient), null);
    }

    @Transactional
    public IngredientDTO updateIngredient(UUID id, IngredientDTO dto, CustomUserDetails user) {
        Ingredient ingredient = ingredientRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Ingrediente no encontrado: " + id));

        validateRestaurantOwnership(user, ingredient.getRestaurant().getId());

        ingredient.setName(dto.name());
        ingredient.setUnitOfMeasure(dto.unitOfMeasure());
        if (dto.active() != null) {
            ingredient.setActive(dto.active());
        }

        return mapToDTO(ingredientRepository.save(ingredient), null);
    }

    @Transactional
    public IngredientDTO updateStock(UUID id, UUID branchId, BigDecimal stock, CustomUserDetails user) {
        Ingredient ingredient = ingredientRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Ingrediente no encontrado: " + id));

        validateRestaurantOwnership(user, ingredient.getRestaurant().getId());

        Branch branch = branchRepository.findById(branchId)
                .orElseThrow(() -> new IllegalArgumentException("Sucursal no encontrada: " + branchId));

        BranchIngredientStock stockEntry = branchIngredientStockRepository
                .findByBranchIdAndIngredientId(branchId, id)
                .orElseGet(() -> BranchIngredientStock.builder()
                        .id(new BranchIngredientStockKey(branchId, id))
                        .branch(branch)
                        .ingredient(ingredient)
                        .stock(BigDecimal.ZERO)
                        .build());

        stockEntry.setStock(stock != null ? stock : BigDecimal.ZERO);
        branchIngredientStockRepository.save(stockEntry);

        return mapToDTO(ingredient, branchId);
    }

    @Transactional
    public void deleteIngredient(UUID id, CustomUserDetails user) {
        Ingredient ingredient = ingredientRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Ingrediente no encontrado: " + id));

        validateRestaurantOwnership(user, ingredient.getRestaurant().getId());
        ingredientRepository.delete(ingredient);
    }

    private void validateRestaurantOwnership(CustomUserDetails user, UUID resourceRestaurantId) {
        if (user.restaurantId() == null || !user.restaurantId().equals(resourceRestaurantId)) {
            throw new AccessDeniedException("User does not have access to this restaurant's ingredients");
        }
    }

    private IngredientDTO mapToDTO(Ingredient ingredient, UUID branchId) {
        BigDecimal currentStock = null;
        if (branchId != null) {
            currentStock = branchIngredientStockRepository
                    .findByBranchIdAndIngredientId(branchId, ingredient.getId())
                    .map(BranchIngredientStock::getStock)
                    .orElse(BigDecimal.ZERO);
        }

        return new IngredientDTO(
                ingredient.getId(),
                ingredient.getRestaurant().getId(),
                ingredient.getName(),
                ingredient.getUnitOfMeasure(),
                currentStock,
                ingredient.getActive());
    }
}
