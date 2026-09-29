package com.omnirest.omnirest_backend.services;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Map;

/**
 * Las unidades en que se lleva el inventario y se escriben las recetas, y la
 * unica conversion entre ellas. Antes cada servicio convertia por su cuenta y
 * la receta se convertia dos veces: 250 g terminaban descontando 0.00025 kg.
 *
 * Masa (g, kg) y volumen (ml, l) se convierten dentro de su familia. Las
 * unidades de conteo (pieza, manojo...) solo equivalen a si mismas.
 */
public final class Unidades {

    private Unidades() {}

    /** Unidad canonica -> familia y cuantas unidades base vale (g o ml). */
    private record Unidad(String familia, BigDecimal factor) {}

    private static final Map<String, Unidad> CONOCIDAS = Map.of(
            "g", new Unidad("masa", BigDecimal.ONE),
            "kg", new Unidad("masa", BigDecimal.valueOf(1000)),
            "ml", new Unidad("volumen", BigDecimal.ONE),
            "l", new Unidad("volumen", BigDecimal.valueOf(1000)));

    private static final Map<String, String> ALIAS = Map.ofEntries(
            Map.entry("gr", "g"), Map.entry("grs", "g"), Map.entry("gramo", "g"), Map.entry("gramos", "g"),
            Map.entry("kilo", "kg"), Map.entry("kilos", "kg"), Map.entry("kgs", "kg"),
            Map.entry("kilogramo", "kg"), Map.entry("kilogramos", "kg"),
            Map.entry("mililitro", "ml"), Map.entry("mililitros", "ml"),
            Map.entry("lt", "l"), Map.entry("lts", "l"), Map.entry("litro", "l"), Map.entry("litros", "l"),
            Map.entry("pz", "pieza"), Map.entry("pza", "pieza"), Map.entry("pzas", "pieza"),
            Map.entry("pzs", "pieza"), Map.entry("piezas", "pieza"), Map.entry("unidad", "pieza"),
            Map.entry("unidades", "pieza"),
            Map.entry("manojos", "manojo"), Map.entry("tabletas", "tableta"));

    /** "Kilos", " KG " y "kg" son la misma unidad: "kg". Null o vacio queda en null. */
    public static String canonica(String unidad) {
        if (unidad == null || unidad.isBlank()) return null;
        String u = unidad.trim().toLowerCase().replaceAll("\\.$", "");
        return ALIAS.getOrDefault(u, u);
    }

    /** Se puede convertir de una a otra (mismas unidades o misma familia). */
    public static boolean compatibles(String desde, String hacia) {
        String a = canonica(desde);
        String b = canonica(hacia);
        if (a == null || b == null || a.equals(b)) return true;
        Unidad ua = CONOCIDAS.get(a);
        Unidad ub = CONOCIDAS.get(b);
        return ua != null && ub != null && ua.familia().equals(ub.familia());
    }

    /**
     * Pasa una cantidad de una unidad a otra: 250 g -> 0.250 kg. Si alguna no
     * se conoce o son la misma, la cantidad queda igual.
     *
     * @throws IllegalArgumentException si son de familias distintas (g -> ml)
     */
    public static BigDecimal convertir(BigDecimal cantidad, String desde, String hacia) {
        if (cantidad == null) return BigDecimal.ZERO;
        String a = canonica(desde);
        String b = canonica(hacia);
        if (a == null || b == null || a.equals(b)) return cantidad;
        Unidad ua = CONOCIDAS.get(a);
        Unidad ub = CONOCIDAS.get(b);
        if (ua == null || ub == null || !ua.familia().equals(ub.familia())) {
            throw new IllegalArgumentException("No se puede convertir de " + a + " a " + b + ".");
        }
        return cantidad.multiply(ua.factor()).divide(ub.factor(), 6, RoundingMode.HALF_UP).stripTrailingZeros();
    }
}
