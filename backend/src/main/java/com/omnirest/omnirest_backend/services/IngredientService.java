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
    private final com.omnirest.omnirest_backend.repositories.RecipeItemRepository recipeItemRepository;
    private final InventoryService inventoryService;
    private final com.omnirest.omnirest_backend.repositories.MovimientoInventarioRepository movimientoRepository;

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

        // Existencias de la sucursal en una sola consulta (antes era una por ingrediente).
        java.util.Map<UUID, BigDecimal> existencias = branchId == null ? java.util.Map.of()
                : branchIngredientStockRepository.findByBranchId(branchId).stream()
                        .collect(Collectors.toMap(s -> s.getId().getIngredientId(), BranchIngredientStock::getStock, (a, b) -> a));
        java.util.Map<UUID, Integer> usos = recipeItemRepository.usosPorIngrediente(restaurantId).stream()
                .collect(Collectors.toMap(f -> (UUID) f[0], f -> ((Number) f[1]).intValue()));
        return ingredientRepository.findByRestaurantId(restaurantId).stream()
                .map(i -> toDTO(i, branchId == null ? null : existencias.getOrDefault(i.getId(), BigDecimal.ZERO),
                        usos.getOrDefault(i.getId(), 0)))
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
                .name(nombreValido(dto.name()))
                .unitOfMeasure(unidadValida(dto.unitOfMeasure()))
                .active(dto.active() != null ? dto.active() : true)
                .minimo(minimoValido(dto.minimo()))
                .build();

        return mapToDTO(ingredientRepository.save(ingredient), null);
    }

    @Transactional
    public IngredientDTO updateIngredient(UUID id, IngredientDTO dto, CustomUserDetails user) {
        Ingredient ingredient = ingredientRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Ingrediente no encontrado: " + id));

        validateRestaurantOwnership(user, ingredient.getRestaurant().getId());

        ingredient.setName(nombreValido(dto.name()));
        String unidadNueva = unidadValida(dto.unitOfMeasure());
        String unidadActual = Unidades.canonica(ingredient.getUnitOfMeasure());
        if (!unidadNueva.equals(unidadActual) && enUso(ingredient)) {
            // Cambiar de kg a g haría que "25" pasara de 25 kg a 25 g, y las recetas
            // y adicionales ya escritos quedarían en otra escala.
            throw new IllegalArgumentException("No se puede cambiar la unidad de " + ingredient.getName()
                    + " porque ya tiene existencias o se usa en recetas. Crea un ingrediente nuevo con la unidad que necesitas.");
        }
        ingredient.setUnitOfMeasure(unidadNueva);
        if (dto.active() != null) {
            ingredient.setActive(dto.active());
        }
        ingredient.setMinimo(minimoValido(dto.minimo()));

        return mapToDTO(ingredientRepository.save(ingredient), null);
    }

    @Transactional
    public IngredientDTO updateStock(UUID id, UUID branchId, BigDecimal stock, CustomUserDetails user) {
        Ingredient ingredient = ingredientRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Ingrediente no encontrado: " + id));

        validateRestaurantOwnership(user, ingredient.getRestaurant().getId());

        branchRepository.findById(branchId)
                .orElseThrow(() -> new IllegalArgumentException("Sucursal no encontrada: " + branchId));
        if (stock == null || stock.signum() < 0) {
            throw new IllegalArgumentException("Las existencias no pueden ser negativas.");
        }
        inventoryService.fijarIngrediente(branchId, ingredient, stock,
                com.omnirest.omnirest_backend.domain.enums.TipoMovimiento.AJUSTE, "Ajuste desde el panel");

        return mapToDTO(ingredient, branchId);
    }

    @Transactional
    public void deleteIngredient(UUID id, CustomUserDetails user) {
        Ingredient ingredient = ingredientRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Ingrediente no encontrado: " + id));

        validateRestaurantOwnership(user, ingredient.getRestaurant().getId());

        // Borrarlo lo quitaba en silencio de todas las recetas y existencias. Si
        // se usa o ya tiene historia, se desactiva: deja de ofrecerse en el
        // editor de recetas, pero las recetas y el historial se conservan.
        long enRecetas = recipeItemRepository.countByIngredientId(id);
        long enAdicionales = ingredientRepository.adicionalesQueLoUsan(id);
        if (enRecetas > 0 || enAdicionales > 0) {
            throw new IllegalStateException(ingredient.getName() + " se usa en "
                    + (enRecetas > 0 ? enRecetas + (enRecetas == 1 ? " platillo" : " platillos") : "")
                    + (enRecetas > 0 && enAdicionales > 0 ? " y " : "")
                    + (enAdicionales > 0 ? enAdicionales + (enAdicionales == 1 ? " adicional" : " adicionales") : "")
                    + ". Desactívalo para que deje de ofrecerse sin romper esas recetas.");
        }
        if (movimientoRepository.existsByIngredientId(id)
                || branchIngredientStockRepository.existsByIngredientIdAndStockNot(id, BigDecimal.ZERO)) {
            throw new IllegalStateException(ingredient.getName()
                    + " ya tiene existencias o historial. Desactívalo en lugar de borrarlo.");
        }
        ingredientRepository.delete(ingredient);
    }

    private static BigDecimal minimoValido(BigDecimal minimo) {
        if (minimo == null || minimo.signum() == 0) return null;
        if (minimo.signum() < 0) throw new IllegalArgumentException("El mínimo no puede ser negativo.");
        return minimo;
    }

    private String nombreValido(String nombre) {
        if (nombre == null || nombre.isBlank()) {
            throw new IllegalArgumentException("Escribe el nombre del ingrediente.");
        }
        return nombre.trim();
    }

    /** "Kilos" se guarda como "kg": una sola forma de escribir cada unidad. */
    private String unidadValida(String unidad) {
        String canonica = Unidades.canonica(unidad);
        if (canonica == null) {
            throw new IllegalArgumentException("Elige en qué unidad se lleva el ingrediente.");
        }
        return canonica;
    }

    private boolean enUso(Ingredient ingredient) {
        return recipeItemRepository.countByIngredientId(ingredient.getId()) > 0
                || branchIngredientStockRepository.existsByIngredientIdAndStockNot(ingredient.getId(), BigDecimal.ZERO);
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
        return toDTO(ingredient, currentStock, (int) recipeItemRepository.countByIngredientId(ingredient.getId()));
    }

    private IngredientDTO toDTO(Ingredient ingredient, BigDecimal currentStock, Integer usos) {
        return new IngredientDTO(
                ingredient.getId(),
                ingredient.getRestaurant().getId(),
                ingredient.getName(),
                ingredient.getUnitOfMeasure(),
                currentStock,
                ingredient.getActive(),
                ingredient.getMinimo(),
                usos);
    }
}
