package com.omnirest.omnirest_backend.services;

import com.omnirest.omnirest_backend.domain.entities.ComboItem;
import com.omnirest.omnirest_backend.domain.entities.Ingredient;
import com.omnirest.omnirest_backend.domain.entities.PreparacionComponente;
import com.omnirest.omnirest_backend.domain.entities.Product;
import com.omnirest.omnirest_backend.domain.entities.RecipeItem;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Cuanto cuesta hacer un platillo con los costos promedio de hoy.
 *
 * Los costos salen de {@link Precios}: los de una sucursal (lo que pago ella)
 * o los generales del restaurante (el promedio de todas). Asi el gerente ve
 * el margen de su sucursal y el dueño el de cada una o el de todas.
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

    /** De donde sale el costo por unidad de cada ingrediente y producto terminado. */
    public interface Precios {
        /** Costo propio (sin calcular con receta); null si no hay. */
        BigDecimal propioDe(Ingredient i);

        BigDecimal deProducto(Product p);
    }

    /** Los generales del restaurante: el promedio de todas sus sucursales. */
    public static final Precios GENERALES = new Precios() {
        public BigDecimal propioDe(Ingredient i) {
            return i.getCostoPromedio();
        }

        public BigDecimal deProducto(Product p) {
            return p.getCostoPromedio();
        }
    };

    /**
     * Los de una sucursal. Lo que la sucursal no tiene costeado todavia (nunca
     * lo ha comprado ni le ha llegado) toma el general del restaurante.
     */
    public static Precios deSucursal(Map<UUID, BigDecimal> ingredientes, Map<UUID, BigDecimal> productos) {
        return new Precios() {
            public BigDecimal propioDe(Ingredient i) {
                BigDecimal propio = ingredientes.get(i.getId());
                return propio != null ? propio : i.getCostoPromedio();
            }

            public BigDecimal deProducto(Product p) {
                BigDecimal propio = productos.get(p.getId());
                return propio != null ? propio : p.getCostoPromedio();
            }
        };
    }

    /** Receta, producto terminado o combo, con los costos generales. */
    public static Costo dePlatillo(Product p, List<RecipeItem> receta) {
        return dePlatillo(p, receta, GENERALES);
    }

    /** Receta, producto terminado o combo. Sin valor si el platillo no lleva inventario. */
    public static Costo dePlatillo(Product p, List<RecipeItem> receta, Precios precios) {
        if (Combos.esCombo(p)) {
            BigDecimal total = BigDecimal.ZERO;
            boolean completo = true;
            for (ComboItem parte : p.getComboItems()) {
                Costo c = dePlatillo(parte.getProducto(), parte.getProducto().getRecipeItems(), precios);
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
                BigDecimal unitario = deIngrediente(r.getIngredient(), precios);
                if (unitario == null) {
                    completo = false;
                    continue;
                }
                total = total.add(InventoryService.consumoPorPlatillo(r).multiply(unitario));
            }
            return new Costo(redondear(total), completo);
        }
        if (Boolean.TRUE.equals(p.getTrackStock())) {
            BigDecimal costo = precios.deProducto(p);
            return costo != null ? new Costo(redondear(costo), true) : Costo.NINGUNO;
        }
        return Costo.NINGUNO;
    }

    public static BigDecimal deIngrediente(Ingredient i) {
        return deIngrediente(i, GENERALES);
    }

    /** Hasta cuantas preparaciones dentro de otras se siguen al costear. */
    static final int NIVELES = 5;

    /**
     * Costo por unidad de un ingrediente. Uno preparado sin costo propio se
     * calcula con su receta: la suma de sus componentes entre lo que rinde.
     */
    public static BigDecimal deIngrediente(Ingredient i, Precios precios) {
        return deIngrediente(i, precios, 0);
    }

    private static BigDecimal deIngrediente(Ingredient i, Precios precios, int nivel) {
        if (i == null) return null;
        BigDecimal propio = precios.propioDe(i);
        if (propio != null) return propio;
        if (Boolean.TRUE.equals(i.getEsPreparado()) && nivel < NIVELES) return dePreparacion(i, precios, nivel + 1);
        return null;
    }

    public static BigDecimal dePreparacion(Ingredient preparado) {
        return dePreparacion(preparado, GENERALES);
    }

    /**
     * Costo por unidad de un preparado segun su receta, o null si falta algun
     * costo. Un componente que tambien es preparacion se costea con su propia
     * receta si no tiene costo propio.
     */
    public static BigDecimal dePreparacion(Ingredient preparado, Precios precios) {
        return dePreparacion(preparado, precios, 0);
    }

    private static BigDecimal dePreparacion(Ingredient preparado, Precios precios, int nivel) {
        if (preparado.getRinde() == null || preparado.getRinde().signum() <= 0
                || preparado.getComponentes() == null || preparado.getComponentes().isEmpty()) {
            return null;
        }
        BigDecimal tanda = BigDecimal.ZERO;
        for (PreparacionComponente c : preparado.getComponentes()) {
            BigDecimal unitario = deIngrediente(c.getComponente(), precios, nivel);
            if (unitario == null) return null;
            tanda = tanda.add(enUnidadDe(c).multiply(unitario));
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
