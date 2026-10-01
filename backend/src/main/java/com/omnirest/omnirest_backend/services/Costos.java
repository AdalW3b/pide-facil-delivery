package com.omnirest.omnirest_backend.services;

import com.omnirest.omnirest_backend.domain.entities.ComboItem;
import com.omnirest.omnirest_backend.domain.entities.Ingredient;
import com.omnirest.omnirest_backend.domain.entities.PreparacionComponente;
import com.omnirest.omnirest_backend.domain.entities.Product;
import com.omnirest.omnirest_backend.domain.entities.RecipeItem;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;

/**
 * Cuanto cuesta hacer un platillo con los costos promedio de hoy.
 *
 * "completo" es false si algun ingrediente no tiene costo capturado: el numero
 * que sale es lo que se sabe, y la pantalla lo marca como incompleto en vez
 * de presumir un margen que no es.
 */
public final class Costos {

    private Costos() {
    }

    public record Costo(BigDecimal valor, boolean completo) {
        static final Costo NINGUNO = new Costo(null, false);
    }

    /** Receta, producto terminado o combo. Null si el platillo no lleva inventario. */
    public static Costo dePlatillo(Product p, List<RecipeItem> receta) {
        if (Combos.esCombo(p)) {
            BigDecimal total = BigDecimal.ZERO;
            boolean completo = true;
            for (ComboItem parte : p.getComboItems()) {
                Costo c = dePlatillo(parte.getProducto(), parte.getProducto().getRecipeItems());
                if (c.valor() == null) {
                    completo = false;
                    continue;
                }
                total = total.add(c.valor().multiply(BigDecimal.valueOf(parte.getCantidad())));
                completo &= c.completo();
            }
            return new Costo(redondear(total), completo);
        }
        if (Boolean.TRUE.equals(p.getIsRecipe())) {
            if (receta == null || receta.isEmpty()) return Costo.NINGUNO;
            BigDecimal total = BigDecimal.ZERO;
            boolean completo = true;
            for (RecipeItem r : receta) {
                BigDecimal unitario = deIngrediente(r.getIngredient());
                if (unitario == null) {
                    completo = false;
                    continue;
                }
                total = total.add(InventoryService.consumoPorPlatillo(r).multiply(unitario));
            }
            return new Costo(redondear(total), completo);
        }
        if (Boolean.TRUE.equals(p.getTrackStock())) {
            return p.getCostoPromedio() != null ? new Costo(redondear(p.getCostoPromedio()), true) : Costo.NINGUNO;
        }
        return Costo.NINGUNO;
    }

    /**
     * Costo por unidad de un ingrediente. Uno preparado sin costo propio se
     * calcula con su receta: la suma de sus componentes entre lo que rinde.
     */
    public static BigDecimal deIngrediente(Ingredient i) {
        if (i == null) return null;
        if (i.getCostoPromedio() != null) return i.getCostoPromedio();
        if (Boolean.TRUE.equals(i.getEsPreparado())) return dePreparacion(i);
        return null;
    }

    /** Costo por unidad de un preparado segun su receta, o null si falta algun costo. */
    public static BigDecimal dePreparacion(Ingredient preparado) {
        if (preparado.getRinde() == null || preparado.getRinde().signum() <= 0
                || preparado.getComponentes() == null || preparado.getComponentes().isEmpty()) {
            return null;
        }
        BigDecimal tanda = BigDecimal.ZERO;
        for (PreparacionComponente c : preparado.getComponentes()) {
            Ingredient comp = c.getComponente();
            if (comp.getCostoPromedio() == null) return null; // un nivel: los componentes no son preparados
            tanda = tanda.add(enUnidadDe(c).multiply(comp.getCostoPromedio()));
        }
        return tanda.divide(preparado.getRinde(), 4, RoundingMode.HALF_UP);
    }

    /** La cantidad del componente en la unidad en que se lleva su inventario. */
    public static BigDecimal enUnidadDe(PreparacionComponente c) {
        String unidadInventario = c.getComponente().getUnitOfMeasure();
        if (c.getUnidad() == null || c.getUnidad().isBlank()) return c.getCantidad();
        try {
            return Unidades.convertir(c.getCantidad(), c.getUnidad(), unidadInventario);
        } catch (IllegalArgumentException e) {
            return c.getCantidad();
        }
    }

    private static BigDecimal redondear(BigDecimal n) {
        return n.setScale(2, RoundingMode.HALF_UP);
    }
}
