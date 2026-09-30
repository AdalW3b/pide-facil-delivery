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
    private final ComboItemRepository comboItemRepository;
    private final InventoryService inventoryService;
    private final AgotadosService agotadosService;

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
        List<Product> productos = productRepository.findByCategoryRestaurantId(restaurantId);
        java.util.Set<UUID> manuales = branchId != null ? agotadosService.manuales(branchId) : java.util.Set.of();
        java.util.Set<UUID> agotados = branchId != null ? agotadosService.agotados(branchId, productos) : java.util.Set.of();
        return productos.stream()
                .map(p -> conAgotado(mapToResponse(p, branchId, existencias), agotados.contains(p.getId()),
                        manuales.contains(p.getId())))
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

        if (Boolean.TRUE.equals(dto.isCombo())) {
            armarCombo(product, dto);
        } else if (Boolean.TRUE.equals(dto.isRecipe()) && dto.recipeItems() != null) {
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

        if (Boolean.TRUE.equals(dto.isCombo())) {
            armarCombo(product, dto);
        } else {
            product.setIsCombo(false);
            product.getComboItems().clear();
            product.setPromoDesde(null);
            product.setPromoHasta(null);
            product.setPromoDias(null);
            if (Boolean.TRUE.equals(dto.isRecipe()) && dto.recipeItems() != null) {
                product.getRecipeItems().clear();
                for (RecipeItemDTO itemDto : dto.recipeItems()) {
                    product.getRecipeItems().add(renglonDeReceta(product, itemDto, restauranteDe(product)));
                }
            } else {
                product.getRecipeItems().clear();
            }
        }

        Product savedProduct = productRepository.save(product);

        return mapToResponse(savedProduct, null);
    }

    @Transactional
    public ProductResponseDTO updateStock(UUID id, UUID branchId, Integer stock, CustomUserDetails user) {
        Product product = productRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Product not found"));

        validateRestaurantOwnership(user, product.getCategory().getRestaurant().getId());

        branchRepository.findById(branchId)
                .orElseThrow(() -> new IllegalArgumentException("Branch not found: " + branchId));
        if (stock == null || stock < 0) {
            throw new IllegalArgumentException("Las existencias no pueden ser negativas.");
        }
        inventoryService.fijarProducto(branchId, product, stock,
                com.omnirest.omnirest_backend.domain.enums.TipoMovimiento.AJUSTE, "Ajuste desde el panel");

        return mapToResponse(product, branchId);
    }

    @Transactional
    public void deleteProduct(UUID id, CustomUserDetails user) {
        Product product = productRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Product not found"));

        validateRestaurantOwnership(user, product.getCategory().getRestaurant().getId());
        List<String> combos = comboItemRepository.findByProductoId(id).stream()
                .map(c -> c.getCombo().getName())
                .distinct()
                .toList();
        if (!combos.isEmpty()) {
            throw new IllegalArgumentException(product.getName() + " va en " + (combos.size() == 1 ? "el combo " : "los combos ")
                    + String.join(", ", combos) + ". Quítalo del combo antes de eliminarlo, o solo desactívalo.");
        }
        productRepository.delete(product);
    }

    /**
     * Deja el producto como combo: sus platillos y su vigencia. Un combo no
     * lleva receta ni existencias propias; gasta lo de sus platillos.
     */
    private void armarCombo(Product combo, ProductRequestDTO dto) {
        UUID restaurantId = restauranteDe(combo);
        if (dto.comboItems() == null || dto.comboItems().isEmpty()) {
            throw new IllegalArgumentException("Agrega al menos un platillo al combo.");
        }
        if (dto.promoDesde() != null && dto.promoHasta() != null && dto.promoDesde().isAfter(dto.promoHasta())) {
            throw new IllegalArgumentException("La promoción termina antes de empezar: revisa las fechas.");
        }

        // Mismo platillo dos veces = una sola linea con la cantidad sumada.
        java.util.Map<UUID, Integer> cantidades = new java.util.LinkedHashMap<>();
        for (com.omnirest.omnirest_backend.dtos.ComboItemDTO parte : dto.comboItems()) {
            if (parte.productId() == null) {
                throw new IllegalArgumentException("Elige el platillo de cada renglón del combo.");
            }
            int cantidad = parte.cantidad() != null ? parte.cantidad() : 1;
            if (cantidad < 1 || cantidad > 50) {
                throw new IllegalArgumentException("La cantidad de cada platillo del combo va de 1 a 50.");
            }
            cantidades.merge(parte.productId(), cantidad, Integer::sum);
        }
        if (cantidades.values().stream().mapToInt(Integer::intValue).sum() < 2) {
            throw new IllegalArgumentException("Un combo lleva al menos 2 platillos (pueden ser 2 del mismo).");
        }

        List<ComboItem> partes = new ArrayList<>();
        int orden = 0;
        for (var e : cantidades.entrySet()) {
            Product platillo = productRepository.findById(e.getKey())
                    .orElseThrow(() -> new IllegalArgumentException("Uno de los platillos del combo ya no existe."));
            if (platillo.getCategory() == null || !restauranteDe(platillo).equals(restaurantId)) {
                throw new IllegalArgumentException(platillo.getName() + " no es de este restaurante.");
            }
            if (combo.getId() != null && combo.getId().equals(platillo.getId())) {
                throw new IllegalArgumentException("Un combo no puede incluirse a sí mismo.");
            }
            if (Combos.esCombo(platillo)) {
                throw new IllegalArgumentException(platillo.getName()
                        + " ya es un combo: arma el nuevo con los platillos sueltos.");
            }
            if (e.getValue() > 50) {
                throw new IllegalArgumentException("La cantidad de cada platillo del combo va de 1 a 50.");
            }
            partes.add(ComboItem.builder().combo(combo).producto(platillo).cantidad(e.getValue()).orden(orden++).build());
        }

        combo.setIsCombo(true);
        combo.setIsRecipe(false);
        combo.setTrackStock(false);
        combo.getRecipeItems().clear();
        combo.getComboItems().clear();
        combo.getComboItems().addAll(partes);
        combo.setPromoDesde(dto.promoDesde());
        combo.setPromoHasta(dto.promoHasta());
        combo.setPromoDias(Combos.diasParaGuardar(dto.promoDias()));
    }

    private static ProductResponseDTO conAgotado(ProductResponseDTO r, boolean agotado, boolean aMano) {
        return new ProductResponseDTO(r.id(), r.categoryId(), r.categoryName(), r.name(), r.price(), r.description(),
                r.active(), r.trackStock(), r.stock(), r.isRecipe(), r.recipeItems(), r.isCombo(), r.comboItems(),
                r.precioNormal(), r.promoDesde(), r.promoHasta(), r.promoDias(), r.vigencia(), r.vigenteHoy(),
                agotado, aMano);
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

    /**
     * Cuantos se pueden vender en la sucursal con lo que hay. null = sin limite
     * (no se lleva inventario de ese platillo).
     */
    private Integer porcionesDe(Product p, UUID branchId, java.util.Map<UUID, BigDecimal> existencias) {
        if (!Boolean.TRUE.equals(p.getActive())) return 0;
        if (Boolean.TRUE.equals(p.getIsRecipe())) {
            List<RecipeItem> items = p.getRecipeItems() != null && !p.getRecipeItems().isEmpty()
                    ? p.getRecipeItems()
                    : recipeItemRepository.findByProductId(p.getId());
            if (items.isEmpty()) return 0;
            int max = Integer.MAX_VALUE;
            for (RecipeItem item : items) {
                BigDecimal porPlatillo = InventoryService.consumoPorPlatillo(item);
                if (porPlatillo == null || porPlatillo.compareTo(BigDecimal.ZERO) <= 0) return 0;
                BigDecimal hay = existencias.getOrDefault(item.getIngredient().getId(), BigDecimal.ZERO);
                max = Math.min(max, hay.divide(porPlatillo, 0, RoundingMode.DOWN).intValue());
            }
            return Math.max(0, max);
        }
        if (Boolean.TRUE.equals(p.getTrackStock())) {
            return branchProductStockRepository.findByBranchIdAndProductId(branchId, p.getId())
                    .map(BranchProductStock::getStock)
                    .orElse(0);
        }
        return null;
    }

    /** Combos que alcanzan: el platillo que se acaba primero manda. */
    private Integer combosDisponibles(Product combo, UUID branchId, java.util.Map<UUID, BigDecimal> existencias) {
        Integer min = null;
        for (ComboItem parte : combo.getComboItems()) {
            Integer porciones = porcionesDe(parte.getProducto(), branchId, existencias);
            if (porciones == null) continue;
            int alcanzan = porciones / parte.getCantidad();
            min = min == null ? alcanzan : Math.min(min, alcanzan);
        }
        return min;
    }

    private ProductResponseDTO mapToResponse(Product product, UUID branchId) {
        return mapToResponse(product, branchId, existenciasDe(branchId));
    }

    private ProductResponseDTO mapToResponse(Product product, UUID branchId, java.util.Map<UUID, BigDecimal> existencias) {
        Integer currentStock = null;
        List<RecipeItemDTO> recipeItemDTOs = null;

        List<com.omnirest.omnirest_backend.dtos.ComboItemDTO> comboItemDTOs = null;
        BigDecimal precioNormal = null;

        if (Combos.esCombo(product)) {
            comboItemDTOs = product.getComboItems().stream()
                    .map(c -> new com.omnirest.omnirest_backend.dtos.ComboItemDTO(
                            c.getProducto().getId(),
                            c.getCantidad(),
                            c.getProducto().getName(),
                            c.getProducto().getPrice(),
                            c.getProducto().getActive()))
                    .toList();
            precioNormal = product.getComboItems().stream()
                    .map(c -> c.getProducto().getPrice().multiply(BigDecimal.valueOf(c.getCantidad())))
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
            if (branchId != null) {
                currentStock = combosDisponibles(product, branchId, existencias);
            }
        } else if (Boolean.TRUE.equals(product.getIsRecipe())) {
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
                recipeItemDTOs,
                Combos.esCombo(product),
                comboItemDTOs,
                precioNormal,
                product.getPromoDesde(),
                product.getPromoHasta(),
                Combos.dias(product.getPromoDias()).stream().map(java.time.DayOfWeek::getValue).toList(),
                Combos.textoVigencia(product),
                Combos.vigenteHoy(product),
                false,
                false);
    }
}
