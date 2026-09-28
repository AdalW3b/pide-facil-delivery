package com.omnirest.omnirest_backend.services;

import com.omnirest.omnirest_backend.domain.entities.*;
import com.omnirest.omnirest_backend.repositories.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Transactional
public class InventoryService {

    private final BranchIngredientStockRepository branchIngredientStockRepository;
    private final BranchProductStockRepository branchProductStockRepository;
    private final RecipeItemRepository recipeItemRepository;
    private final BranchRepository branchRepository;
    private final IngredientRepository ingredientRepository;
    private final ProductRepository productRepository;

    private BigDecimal normalizeQuantity(BigDecimal recipeQty, String recipeUnit, String ingredientUnit) {
        if (recipeQty == null) return BigDecimal.ZERO;
        if (recipeUnit == null || ingredientUnit == null) return recipeQty;
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

    @Transactional
    public void setAbsoluteStock(UUID itemId, UUID branchId, Number newStock, boolean isIngredient) {
        if (itemId == null || branchId == null || newStock == null) {
            return;
        }

        Branch branch = branchRepository.findById(branchId)
                .orElseThrow(() -> new IllegalArgumentException("Branch not found: " + branchId));

        if (isIngredient) {
            Ingredient ingredient = ingredientRepository.findById(itemId)
                    .orElseThrow(() -> new IllegalArgumentException("Ingredient not found: " + itemId));

            BranchIngredientStock stockEntry = branchIngredientStockRepository
                    .findByBranchIdAndIngredientId(branchId, itemId)
                    .orElseGet(() -> BranchIngredientStock.builder()
                            .id(new BranchIngredientStockKey(branchId, itemId))
                            .branch(branch)
                            .ingredient(ingredient)
                            .stock(BigDecimal.ZERO)
                            .build());

            BigDecimal decimalStock = newStock instanceof BigDecimal ? (BigDecimal) newStock
                    : new BigDecimal(newStock.toString());
            stockEntry.setStock(decimalStock);
            branchIngredientStockRepository.save(stockEntry);
        } else {
            Product product = productRepository.findById(itemId)
                    .orElseThrow(() -> new IllegalArgumentException("Product not found: " + itemId));

            BranchProductStock stockEntry = branchProductStockRepository
                    .findByBranchIdAndProductId(branchId, itemId)
                    .orElseGet(() -> BranchProductStock.builder()
                            .id(new BranchProductStockKey(branchId, itemId))
                            .branch(branch)
                            .product(product)
                            .stock(0)
                            .build());

            stockEntry.setStock(newStock.intValue());
            branchProductStockRepository.save(stockEntry);
        }
    }

    public void decrementStock(UUID branchId, UUID productId, Integer quantity) {
        int updatedRows = branchProductStockRepository.subtractStockAtomic(branchId, productId, quantity);

        if (updatedRows == 0) {
            throw new IllegalStateException("Operación rechazada: Stock insuficiente o producto no encontrado en la sucursal.");
        }
    }

    public void checkAndDeductStock(Product product, UUID branchId, int quantitySold) {
        if (quantitySold <= 0 || product == null || branchId == null) {
            return;
        }

        if (Boolean.TRUE.equals(product.getIsRecipe())) {
            List<RecipeItem> recipeItems = product.getRecipeItems() != null && !product.getRecipeItems().isEmpty()
                    ? product.getRecipeItems()
                    : recipeItemRepository.findByProductId(product.getId());

            for (RecipeItem recipe : recipeItems) {
                Ingredient ingredient = recipe.getIngredient();
                BigDecimal normalizedQty = normalizeQuantity(
                        recipe.getQuantity(),
                        recipe.getRecipeUnit(),
                        ingredient != null ? ingredient.getUnitOfMeasure() : null
                );
                BigDecimal cantidadNecesaria = normalizedQty.multiply(BigDecimal.valueOf(quantitySold));

                int updatedRows = branchIngredientStockRepository.subtractStockAtomic(branchId, ingredient.getId(), cantidadNecesaria);
                if (updatedRows == 0) {
                    throw new IllegalStateException("Stock insuficiente del ingrediente: " + (ingredient != null ? ingredient.getName() : "desconocido"));
                }
            }
        } else if (Boolean.TRUE.equals(product.getTrackStock())) {
            decrementStock(branchId, product.getId(), quantitySold);
        }
    }

    /**
     * Descuenta lo que gastan los adicionales de una linea: "Carne extra" en
     * 2 platillos saca dos porciones de pastor. Usa lo congelado en la linea,
     * que es tambien lo que se devuelve si se cancela.
     */
    public void descontarAdicionales(OrderItem item, UUID branchId) {
        if (item == null || item.getAdicionales() == null || branchId == null) return;
        int cantidad = item.getQuantity() != null ? item.getQuantity() : 1;
        for (OrderItemAdicional a : item.getAdicionales()) {
            if (a.getIngredientId() == null || a.getCantidadIngrediente() == null) continue;
            BigDecimal total = a.getCantidadIngrediente().multiply(BigDecimal.valueOf(cantidad));
            int updated = branchIngredientStockRepository.subtractStockAtomic(branchId, a.getIngredientId(), total);
            if (updated == 0) {
                String ingrediente = ingredientRepository.findById(a.getIngredientId())
                        .map(Ingredient::getName).orElse("el ingrediente");
                throw new IllegalStateException("No alcanza " + ingrediente + " para " + a.getNombre()
                        + ". Márcalo como agotado o repón el inventario.");
            }
        }
    }

    /** Devuelve al inventario lo que se desconto por los adicionales de una linea. */
    public void devolverAdicionales(OrderItem item, UUID branchId) {
        if (item == null || item.getAdicionales() == null || branchId == null) return;
        int cantidad = item.getQuantity() != null ? item.getQuantity() : 1;
        for (OrderItemAdicional a : item.getAdicionales()) {
            if (a.getIngredientId() == null || a.getCantidadIngrediente() == null) continue;
            BigDecimal total = a.getCantidadIngrediente().multiply(BigDecimal.valueOf(cantidad));
            int updated = branchIngredientStockRepository.addStockAtomic(branchId, a.getIngredientId(), total);
            if (updated == 0) {
                // No habia registro en la sucursal: se crea con lo devuelto.
                Branch branch = branchRepository.findById(branchId)
                        .orElseThrow(() -> new IllegalArgumentException("Branch not found: " + branchId));
                ingredientRepository.findById(a.getIngredientId()).ifPresent(ingrediente ->
                        branchIngredientStockRepository.save(BranchIngredientStock.builder()
                                .id(new BranchIngredientStockKey(branchId, ingrediente.getId()))
                                .branch(branch)
                                .ingredient(ingrediente)
                                .stock(total)
                                .build()));
            }
        }
    }

    public void restoreStock(Product product, UUID branchId, int quantityRestored) {
        if (quantityRestored <= 0 || product == null || branchId == null) {
            return;
        }

        if (Boolean.TRUE.equals(product.getIsRecipe())) {
            List<RecipeItem> recipeItems = product.getRecipeItems() != null && !product.getRecipeItems().isEmpty()
                    ? product.getRecipeItems()
                    : recipeItemRepository.findByProductId(product.getId());

            for (RecipeItem recipe : recipeItems) {
                Ingredient ingredient = recipe.getIngredient();
                BigDecimal normalizedQty = normalizeQuantity(
                        recipe.getQuantity(),
                        recipe.getRecipeUnit(),
                        ingredient != null ? ingredient.getUnitOfMeasure() : null
                );
                BigDecimal cantidadARestaurar = normalizedQty.multiply(BigDecimal.valueOf(quantityRestored));

                int updated = branchIngredientStockRepository.addStockAtomic(branchId, ingredient.getId(), cantidadARestaurar);
                if (updated == 0) {
                    // El registro no existía: lo creamos con el stock a restaurar como valor inicial
                    Branch branch = branchRepository.findById(branchId)
                            .orElseThrow(() -> new IllegalArgumentException("Branch not found: " + branchId));
                    BranchIngredientStock stockEntry = BranchIngredientStock.builder()
                            .id(new BranchIngredientStockKey(branchId, ingredient.getId()))
                            .branch(branch)
                            .ingredient(ingredient)
                            .stock(cantidadARestaurar)
                            .build();
                    branchIngredientStockRepository.save(stockEntry);
                }
            }
        } else if (Boolean.TRUE.equals(product.getTrackStock())) {
            int updated = branchProductStockRepository.addStockAtomic(branchId, product.getId(), quantityRestored);
            if (updated == 0) {
                Branch branch = branchRepository.findById(branchId)
                        .orElseThrow(() -> new IllegalArgumentException("Branch not found: " + branchId));
                BranchProductStock stockEntry = BranchProductStock.builder()
                        .id(new BranchProductStockKey(branchId, product.getId()))
                        .branch(branch)
                        .product(product)
                        .stock(quantityRestored)
                        .build();
                branchProductStockRepository.save(stockEntry);
            }
        }
    }
}
