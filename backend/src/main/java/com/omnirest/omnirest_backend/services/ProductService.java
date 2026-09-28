package com.omnirest.omnirest_backend.services;

import com.omnirest.omnirest_backend.domain.entities.*;
import com.omnirest.omnirest_backend.dtos.ProductRequestDTO;
import com.omnirest.omnirest_backend.dtos.ProductResponseDTO;
import com.omnirest.omnirest_backend.dtos.RecipeItemDTO;
import com.omnirest.omnirest_backend.repositories.*;
import com.omnirest.omnirest_backend.security.CustomUserDetails;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ProductService {

    private final ProductRepository productRepository;
    private final CategoryRepository categoryRepository;
    private final IngredientRepository ingredientRepository;
    private final RecipeItemRepository recipeItemRepository;
    private final BranchProductStockRepository branchProductStockRepository;
    private final BranchIngredientStockRepository branchIngredientStockRepository;
    private final BranchRepository branchRepository;
    private final RestaurantRepository restaurantRepository;

    private BigDecimal normalizeQuantity(BigDecimal recipeQty, String recipeUnit, String ingredientUnit) {
        if (recipeQty == null)
            return BigDecimal.ZERO;
        if (recipeUnit == null || ingredientUnit == null)
            return recipeQty;
        String rU = recipeUnit.trim().toLowerCase();
        String iU = ingredientUnit.trim().toLowerCase();

        // De mililitros a Litros
        if (rU.equals("ml") && (iU.equals("l") || iU.equals("lt") || iU.equals("litro") || iU.equals("litros"))) {
            return recipeQty.divide(BigDecimal.valueOf(1000), 4, RoundingMode.HALF_UP);
        }
        // De gramos a Kilos
        if (rU.equals("g") && (iU.equals("kg") || iU.equals("kilo") || iU.equals("kilos"))) {
            return recipeQty.divide(BigDecimal.valueOf(1000), 4, RoundingMode.HALF_UP);
        }
        return recipeQty;
    }

    public List<ProductResponseDTO> getProducts(CustomUserDetails user, UUID branchId) {
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
        return productRepository.findByCategoryRestaurantId(restaurantId).stream()
                .map(p -> mapToResponse(p, branchId))
                .collect(Collectors.toList());
    }

    public ProductResponseDTO getProductById(UUID id, CustomUserDetails user, UUID branchId) {
        Product product = productRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Product not found"));

        validateRestaurantOwnership(user, product.getCategory().getRestaurant().getId());

        return mapToResponse(product, branchId);
    }

    @Transactional
    public ProductResponseDTO createProduct(ProductRequestDTO dto, CustomUserDetails user) {
        Category category = categoryRepository.findById(dto.categoryId())
                .orElseThrow(() -> new IllegalArgumentException("Category not found"));

        validateRestaurantOwnership(user, category.getRestaurant().getId());

        Product product = Product.builder()
                .category(category)
                .name(dto.name())
                .price(dto.price())
                .description(dto.description())
                .active(dto.active() != null ? dto.active() : true)
                .trackStock(dto.trackStock() != null ? dto.trackStock() : false)
                .stock(dto.stock())
                .isRecipe(dto.isRecipe() != null ? dto.isRecipe() : false)
                .recipeItems(new ArrayList<>())
                .build();

        if (Boolean.TRUE.equals(dto.isRecipe()) && dto.recipeItems() != null) {
            for (RecipeItemDTO itemDto : dto.recipeItems()) {
                Ingredient ingredient = ingredientRepository.findById(itemDto.ingredientId())
                        .orElseThrow(() -> new IllegalArgumentException(
                                "Ingrediente no encontrado con id: " + itemDto.ingredientId()));

                BigDecimal qty = itemDto.quantity() != null ? itemDto.quantity() : itemDto.requiredPerUnit();
                String rUnit = itemDto.recipeUnit() != null && !itemDto.recipeUnit().isBlank()
                        ? itemDto.recipeUnit()
                        : ingredient.getUnitOfMeasure();

                BigDecimal normalizedQty = normalizeQuantity(qty, rUnit, ingredient.getUnitOfMeasure());

                RecipeItem recipeItem = RecipeItem.builder()
                        .product(product)
                        .ingredient(ingredient)
                        .quantity(normalizedQty)
                        .recipeUnit(rUnit)
                        .build();
                product.getRecipeItems().add(recipeItem);
            }
        }

        Product savedProduct = productRepository.save(product);

        return mapToResponse(savedProduct, null);
    }

    @Transactional
    public ProductResponseDTO updateProduct(UUID id, ProductRequestDTO dto, CustomUserDetails user) {
        Product product = productRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Product not found"));

        validateRestaurantOwnership(user, product.getCategory().getRestaurant().getId());

        Category category = categoryRepository.findById(dto.categoryId())
                .orElseThrow(() -> new IllegalArgumentException("Category not found"));

        validateRestaurantOwnership(user, category.getRestaurant().getId());

        product.setCategory(category);
        product.setName(dto.name());
        product.setPrice(dto.price());
        product.setDescription(dto.description());
        if (dto.active() != null) {
            product.setActive(dto.active());
        }
        if (dto.trackStock() != null) {
            product.setTrackStock(dto.trackStock());
        }
        product.setStock(dto.stock());
        if (dto.isRecipe() != null) {
            product.setIsRecipe(dto.isRecipe());
        }

        if (product.getRecipeItems() == null) {
            product.setRecipeItems(new ArrayList<>());
        }

        if (Boolean.TRUE.equals(dto.isRecipe()) && dto.recipeItems() != null) {
            product.getRecipeItems().clear();
            for (RecipeItemDTO itemDto : dto.recipeItems()) {
                Ingredient ingredient = ingredientRepository.findById(itemDto.ingredientId())
                        .orElseThrow(() -> new IllegalArgumentException(
                                "Ingrediente no encontrado con id: " + itemDto.ingredientId()));

                BigDecimal qty = itemDto.quantity() != null ? itemDto.quantity() : itemDto.requiredPerUnit();
                String rUnit = itemDto.recipeUnit() != null && !itemDto.recipeUnit().isBlank()
                        ? itemDto.recipeUnit()
                        : ingredient.getUnitOfMeasure();

                BigDecimal normalizedQty = normalizeQuantity(qty, rUnit, ingredient.getUnitOfMeasure());

                RecipeItem recipeItem = RecipeItem.builder()
                        .product(product)
                        .ingredient(ingredient)
                        .quantity(normalizedQty)
                        .recipeUnit(rUnit)
                        .build();
                product.getRecipeItems().add(recipeItem);
            }
        } else {
            product.getRecipeItems().clear();
        }

        Product savedProduct = productRepository.save(product);

        return mapToResponse(savedProduct, null);
    }

    @Transactional
    public ProductResponseDTO updateStock(UUID id, UUID branchId, Integer stock, CustomUserDetails user) {
        Product product = productRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Product not found"));

        validateRestaurantOwnership(user, product.getCategory().getRestaurant().getId());

        Branch branch = branchRepository.findById(branchId)
                .orElseThrow(() -> new IllegalArgumentException("Branch not found: " + branchId));

        BranchProductStock stockEntry = branchProductStockRepository
                .findByBranchIdAndProductId(branchId, id)
                .orElseGet(() -> BranchProductStock.builder()
                        .id(new BranchProductStockKey(branchId, id))
                        .branch(branch)
                        .product(product)
                        .stock(0)
                        .build());

        stockEntry.setStock(stock != null ? stock : 0);
        branchProductStockRepository.save(stockEntry);

        return mapToResponse(product, branchId);
    }

    @Transactional
    public void deleteProduct(UUID id, CustomUserDetails user) {
        Product product = productRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Product not found"));

        validateRestaurantOwnership(user, product.getCategory().getRestaurant().getId());
        productRepository.delete(product);
    }

    private void validateRestaurantOwnership(CustomUserDetails user, UUID resourceRestaurantId) {
        if (user.restaurantId() == null || !user.restaurantId().equals(resourceRestaurantId)) {
            throw new AccessDeniedException("User does not have access to this restaurant's products");
        }
    }

    private ProductResponseDTO mapToResponse(Product product, UUID branchId) {
        Integer currentStock = null;
        List<RecipeItemDTO> recipeItemDTOs = null;

        if (Boolean.TRUE.equals(product.getIsRecipe())) {
            List<RecipeItem> items = product.getRecipeItems() != null && !product.getRecipeItems().isEmpty()
                    ? product.getRecipeItems()
                    : recipeItemRepository.findByProductId(product.getId());

            if (items != null && !items.isEmpty()) {
                int maxPortions = Integer.MAX_VALUE;

                if (branchId != null) {
                    for (RecipeItem item : items) {
                        BigDecimal normalizedQty = normalizeQuantity(
                                item.getQuantity(),
                                item.getRecipeUnit(),
                                item.getIngredient() != null ? item.getIngredient().getUnitOfMeasure() : null);

                        if (normalizedQty != null && normalizedQty.compareTo(BigDecimal.ZERO) > 0) {
                            BigDecimal stock = branchIngredientStockRepository
                                    .findByBranchIdAndIngredientId(branchId, item.getIngredient().getId())
                                    .map(BranchIngredientStock::getStock)
                                    .orElse(BigDecimal.ZERO);

                            int possible = stock.divide(normalizedQty, 0, RoundingMode.DOWN).intValue();
                            if (possible < maxPortions) {
                                maxPortions = possible;
                            }
                        } else {
                            maxPortions = 0;
                        }
                    }
                    if (maxPortions == Integer.MAX_VALUE) {
                        maxPortions = 0;
                    }
                    currentStock = Math.max(0, maxPortions);
                }

                final int finalMaxPortions = currentStock != null ? currentStock : 0;

                recipeItemDTOs = items.stream()
                        .map(item -> {
                            BigDecimal reqPerUnit = item.getQuantity();
                            BigDecimal normalizedQty = normalizeQuantity(
                                    item.getQuantity(),
                                    item.getRecipeUnit(),
                                    item.getIngredient() != null ? item.getIngredient().getUnitOfMeasure() : null);

                            BigDecimal availStock = branchId != null
                                    ? branchIngredientStockRepository
                                            .findByBranchIdAndIngredientId(branchId, item.getIngredient().getId())
                                            .map(BranchIngredientStock::getStock)
                                            .orElse(BigDecimal.ZERO)
                                    : null;

                            BigDecimal totalReqForMax = (branchId != null && normalizedQty != null)
                                    ? normalizedQty.multiply(BigDecimal.valueOf(finalMaxPortions))
                                    : null;

                            String recipeUnit = item.getRecipeUnit() != null
                                    ? item.getRecipeUnit()
                                    : (item.getIngredient() != null ? item.getIngredient().getUnitOfMeasure() : null);

                            return new RecipeItemDTO(
                                    item.getId(),
                                    item.getIngredient().getId(),
                                    item.getIngredient().getName(),
                                    item.getIngredient().getUnitOfMeasure(),
                                    recipeUnit,
                                    reqPerUnit,
                                    reqPerUnit,
                                    totalReqForMax,
                                    availStock);
                        })
                        .toList();
            }
        } else if (branchId != null && Boolean.TRUE.equals(product.getTrackStock())) {
            currentStock = branchProductStockRepository.findByBranchIdAndProductId(branchId, product.getId())
                    .map(BranchProductStock::getStock)
                    .orElse(0);
        } else if (branchId != null) {
            currentStock = 0;
        }

        return new ProductResponseDTO(
                product.getId(),
                product.getCategory().getId(),
                product.getCategory().getName(),
                product.getName(),
                product.getPrice(),
                product.getDescription(),
                product.getActive(),
                product.getTrackStock(),
                currentStock,
                product.getIsRecipe(),
                recipeItemDTOs);
    }
}
