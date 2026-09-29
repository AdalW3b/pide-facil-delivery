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
        java.util.Map<UUID, BigDecimal> existencias = existenciasDe(branchId);
        return productRepository.findByCategoryRestaurantId(restaurantId).stream()
                .map(p -> mapToResponse(p, branchId, existencias))
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
                product.getRecipeItems().add(renglonDeReceta(product, itemDto, restauranteDe(product)));
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
                product.getRecipeItems().add(renglonDeReceta(product, itemDto, restauranteDe(product)));
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

        if (stock == null || stock < 0) {
            throw new IllegalArgumentException("Las existencias no pueden ser negativas.");
        }
        stockEntry.setStock(stock);
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

    private UUID restauranteDe(Product product) {
        return product.getCategory().getRestaurant().getId();
    }

    /**
     * Un renglon de receta tal como lo escribio el usuario: "250 g" se guarda
     * como 250 y g. La conversion a la unidad del inventario (kg) se hace una
     * sola vez, al descontar (InventoryService.consumoPorPlatillo).
     */
    private RecipeItem renglonDeReceta(Product product, RecipeItemDTO itemDto, UUID restaurantId) {
        Ingredient ingredient = ingredientRepository.findById(itemDto.ingredientId())
                .orElseThrow(() -> new IllegalArgumentException("Ese ingrediente ya no existe."));
        if (ingredient.getRestaurant() == null || !ingredient.getRestaurant().getId().equals(restaurantId)) {
            throw new IllegalArgumentException("El ingrediente " + ingredient.getName() + " no es de este restaurante.");
        }

        BigDecimal cantidad = itemDto.quantity() != null ? itemDto.quantity() : itemDto.requiredPerUnit();
        if (cantidad == null || cantidad.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("Escribe cuánto lleva de " + ingredient.getName() + ".");
        }

        String unidadInventario = Unidades.canonica(ingredient.getUnitOfMeasure());
        String unidadReceta = itemDto.recipeUnit() != null && !itemDto.recipeUnit().isBlank()
                ? Unidades.canonica(itemDto.recipeUnit())
                : unidadInventario;
        if (!Unidades.compatibles(unidadReceta, unidadInventario)) {
            throw new IllegalArgumentException(ingredient.getName() + " se lleva en " + unidadInventario
                    + ": la receta no puede usar " + unidadReceta + ".");
        }

        return RecipeItem.builder()
                .product(product)
                .ingredient(ingredient)
                .quantity(cantidad)
                .recipeUnit(unidadReceta)
                .build();
    }

    private void validateRestaurantOwnership(CustomUserDetails user, UUID resourceRestaurantId) {
        if (user.restaurantId() == null || !user.restaurantId().equals(resourceRestaurantId)) {
            throw new AccessDeniedException("User does not have access to this restaurant's products");
        }
    }

    /** Existencias de todos los ingredientes de la sucursal, en una consulta. */
    private java.util.Map<UUID, BigDecimal> existenciasDe(UUID branchId) {
        if (branchId == null) return java.util.Map.of();
        return branchIngredientStockRepository.findByBranchId(branchId).stream()
                .collect(Collectors.toMap(s -> s.getId().getIngredientId(), BranchIngredientStock::getStock, (a, b) -> a));
    }

    private ProductResponseDTO mapToResponse(Product product, UUID branchId) {
        return mapToResponse(product, branchId, existenciasDe(branchId));
    }

    private ProductResponseDTO mapToResponse(Product product, UUID branchId, java.util.Map<UUID, BigDecimal> existencias) {
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
                        BigDecimal normalizedQty = InventoryService.consumoPorPlatillo(item);

                        if (normalizedQty != null && normalizedQty.compareTo(BigDecimal.ZERO) > 0) {
                            BigDecimal stock = existencias.getOrDefault(item.getIngredient().getId(), BigDecimal.ZERO);

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
                            BigDecimal normalizedQty = InventoryService.consumoPorPlatillo(item);

                            BigDecimal availStock = branchId != null
                                    ? existencias.getOrDefault(item.getIngredient().getId(), BigDecimal.ZERO)
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
