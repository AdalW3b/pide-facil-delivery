package com.omnirest.omnirest_backend.services;

import com.omnirest.omnirest_backend.domain.entities.*;
import com.omnirest.omnirest_backend.domain.enums.ControlInventario;
import com.omnirest.omnirest_backend.repositories.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Que platillos no se pueden pedir hoy en una sucursal.
 *
 * Dos razones: alguien marco "se acabo" (vale solo ese dia) o, si la sucursal
 * lleva el inventario en modo BLOQUEAR, ya no alcanza para uno. En modo AVISAR
 * no se esconde nada por existencias: el numero puede no estar al dia, y
 * esconder platillos que si hay en la cocina haria perder ventas.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AgotadosService {

    private final ProductoAgotadoRepository agotadoRepository;
    private final ProductRepository productRepository;
    private final BranchRepository branchRepository;
    private final BranchIngredientStockRepository ingredienteStockRepository;
    private final BranchProductStockRepository productoStockRepository;
    private final RecipeItemRepository recipeItemRepository;

    /** Un platillo agotado hoy, para la lista de Cocina. */
    public record Agotado(UUID productId, String nombre, boolean aMano, LocalDateTime desde, String por) {
    }

    /** Los marcados a mano hoy. */
    public Set<UUID> manuales(UUID branchId) {
        return agotadoRepository.findByBranchIdAndDesdeGreaterThanEqual(branchId, Combos.hoy().atStartOfDay()).stream()
                .map(ProductoAgotado::getProductId)
                .collect(Collectors.toSet());
    }

    /** Manuales mas, en modo BLOQUEAR, los que ya no alcanzan. */
    public Set<UUID> agotados(UUID branchId, Collection<Product> productos) {
        Set<UUID> fuera = new HashSet<>(manuales(branchId));
        ControlInventario modo = branchRepository.findById(branchId)
                .map(Branch::getControlInventario).orElse(ControlInventario.AVISAR);
        if (modo != ControlInventario.BLOQUEAR || productos.isEmpty()) return fuera;

        Map<UUID, BigDecimal> ingredientes = ingredienteStockRepository.findByBranchId(branchId).stream()
                .collect(Collectors.toMap(s -> s.getId().getIngredientId(), BranchIngredientStock::getStock, (a, b) -> a));
        Map<UUID, Integer> terminados = productoStockRepository.findByBranchId(branchId).stream()
                .collect(Collectors.toMap(s -> s.getId().getProductId(), BranchProductStock::getStock, (a, b) -> a));

        for (Product p : productos) {
            if (noAlcanza(p, 1, ingredientes, terminados, fuera)) fuera.add(p.getId());
        }
        return fuera;
    }

    public boolean estaAgotado(UUID branchId, Product producto) {
        return agotados(branchId, List.of(producto)).contains(producto.getId());
    }

    private boolean noAlcanza(Product p, int cantidad, Map<UUID, BigDecimal> ingredientes,
                              Map<UUID, Integer> terminados, Set<UUID> manuales) {
        if (manuales.contains(p.getId())) return true;
        if (Combos.esCombo(p)) {
            for (ComboItem parte : p.getComboItems()) {
                if (noAlcanza(parte.getProducto(), parte.getCantidad() * cantidad, ingredientes, terminados, manuales)) {
                    return true;
                }
            }
            return false;
        }
        if (Boolean.TRUE.equals(p.getIsRecipe())) {
            List<RecipeItem> receta = p.getRecipeItems() != null && !p.getRecipeItems().isEmpty()
                    ? p.getRecipeItems() : recipeItemRepository.findByProductId(p.getId());
            for (RecipeItem r : receta) {
                BigDecimal hace = InventoryService.consumoPorPlatillo(r).multiply(BigDecimal.valueOf(cantidad));
                if (ingredientes.getOrDefault(r.getIngredient().getId(), BigDecimal.ZERO).compareTo(hace) < 0) {
                    return true;
                }
            }
            return false;
        }
        if (Boolean.TRUE.equals(p.getTrackStock())) {
            return terminados.getOrDefault(p.getId(), 0) < cantidad;
        }
        return false;
    }

    /** Lo agotado hoy, con nombre, para la pantalla de Cocina. */
    public List<Agotado> lista(UUID branchId) {
        Branch branch = branchRepository.findById(branchId)
                .orElseThrow(() -> new IllegalArgumentException("Sucursal no encontrada."));
        List<Product> activos = productRepository.findByCategoryRestaurantIdAndActiveTrue(branch.getRestaurant().getId());
        Map<UUID, ProductoAgotado> aMano = agotadoRepository
                .findByBranchIdAndDesdeGreaterThanEqual(branchId, Combos.hoy().atStartOfDay()).stream()
                .collect(Collectors.toMap(ProductoAgotado::getProductId, a -> a));
        Set<UUID> todos = agotados(branchId, activos);
        return activos.stream()
                .filter(p -> todos.contains(p.getId()))
                .map(p -> {
                    ProductoAgotado a = aMano.get(p.getId());
                    return new Agotado(p.getId(), p.getName(), a != null,
                            a != null ? a.getDesde() : null, a != null ? a.getPor() : null);
                })
                .sorted(Comparator.comparing(Agotado::nombre, String.CASE_INSENSITIVE_ORDER))
                .toList();
    }

    @Transactional
    public void marcar(UUID branchId, UUID productId, String usuario) {
        Branch branch = branchRepository.findById(branchId)
                .orElseThrow(() -> new IllegalArgumentException("Sucursal no encontrada."));
        Product producto = productRepository.findById(productId)
                .orElseThrow(() -> new IllegalArgumentException("Ese platillo ya no existe."));
        if (!producto.getCategory().getRestaurant().getId().equals(branch.getRestaurant().getId())) {
            throw new IllegalArgumentException("Ese platillo no es de esta sucursal.");
        }
        agotadoRepository.save(ProductoAgotado.builder()
                .branchId(branchId).productId(productId).desde(LocalDateTime.now()).por(usuario).build());
    }

    @Transactional
    public void quitar(UUID branchId, UUID productId) {
        agotadoRepository.deleteById(new ProductoAgotado.Clave(branchId, productId));
    }
}
