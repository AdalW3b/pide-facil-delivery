package com.omnirest.omnirest_backend.services;

import com.omnirest.omnirest_backend.domain.entities.ComboItem;
import com.omnirest.omnirest_backend.domain.entities.Product;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.TreeSet;
import java.util.stream.Collectors;

/**
 * Reglas de los combos y paquetes de promocion: que lleva cada uno y cuando se
 * puede vender. La fecha es la de Mexico, no la del servidor: una promo "solo
 * martes" no debe empezar a las 6 p.m. del lunes porque el servidor este en UTC.
 */
public final class Combos {

    public static final ZoneId ZONA = ZoneId.of("America/Mexico_City");

    private static final String[] DIAS = {"lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"};
    private static final DateTimeFormatter FECHA = DateTimeFormatter.ofPattern("d MMM", Locale.forLanguageTag("es-MX"));

    private Combos() {
    }

    public static LocalDate hoy() {
        return LocalDate.now(ZONA);
    }

    public static boolean esCombo(Product p) {
        return p != null && Boolean.TRUE.equals(p.getIsCombo());
    }

    /** "2,4" -> [martes, jueves]. Vacio = todos los dias. */
    public static List<DayOfWeek> dias(String promoDias) {
        List<DayOfWeek> dias = new ArrayList<>();
        if (promoDias == null || promoDias.isBlank()) return dias;
        for (String d : promoDias.split(",")) {
            try {
                int n = Integer.parseInt(d.trim());
                if (n >= 1 && n <= 7) dias.add(DayOfWeek.of(n));
            } catch (NumberFormatException ignorado) {
                // Un valor raro no bloquea la venta: se ignora.
            }
        }
        return dias;
    }

    /** [2, 4, 2] -> "2,4". null si son todos los dias o ninguno. */
    public static String diasParaGuardar(List<Integer> dias) {
        if (dias == null) return null;
        TreeSet<Integer> unicos = new TreeSet<>();
        for (Integer d : dias) {
            if (d == null || d < 1 || d > 7) {
                throw new IllegalArgumentException("Día de la semana no válido: " + d + ".");
            }
            unicos.add(d);
        }
        if (unicos.isEmpty() || unicos.size() == 7) return null;
        return unicos.stream().map(String::valueOf).collect(Collectors.joining(","));
    }

    /** Si se puede vender en esa fecha. Un platillo normal siempre es vigente. */
    public static boolean vigente(Product p, LocalDate fecha) {
        if (p == null) return false;
        if (p.getPromoDesde() != null && fecha.isBefore(p.getPromoDesde())) return false;
        if (p.getPromoHasta() != null && fecha.isAfter(p.getPromoHasta())) return false;
        List<DayOfWeek> dias = dias(p.getPromoDias());
        return dias.isEmpty() || dias.contains(fecha.getDayOfWeek());
    }

    public static boolean vigenteHoy(Product p) {
        return vigente(p, hoy());
    }

    public static boolean tieneVigencia(Product p) {
        return p != null && (p.getPromoDesde() != null || p.getPromoHasta() != null
                || !dias(p.getPromoDias()).isEmpty());
    }

    /**
     * Cuando se vende, en palabras: "martes y jueves, del 1 oct al 31 oct".
     * null si no tiene limite.
     */
    public static String textoVigencia(Product p) {
        if (!tieneVigencia(p)) return null;
        List<String> partes = new ArrayList<>();
        List<DayOfWeek> dias = dias(p.getPromoDias());
        if (!dias.isEmpty()) {
            partes.add(unir(dias.stream().map(d -> DIAS[d.getValue() - 1]).toList()));
        }
        LocalDate desde = p.getPromoDesde();
        LocalDate hasta = p.getPromoHasta();
        if (desde != null && hasta != null) {
            partes.add("del " + FECHA.format(desde) + " al " + FECHA.format(hasta));
        } else if (desde != null) {
            partes.add("desde el " + FECHA.format(desde));
        } else if (hasta != null) {
            partes.add("hasta el " + FECHA.format(hasta));
        }
        return String.join(", ", partes);
    }

    /** Falla con un mensaje claro si el combo no se puede vender hoy. */
    public static void validarVigente(Product p) {
        if (!vigenteHoy(p)) {
            throw new IllegalStateException("El combo " + p.getName() + " no está disponible hoy (se vende "
                    + textoVigencia(p) + ").");
        }
    }

    /** "4 × Taco al pastor, 2 × Refresco". */
    public static String textoIncluye(Product combo) {
        if (combo == null || combo.getComboItems() == null) return "";
        return combo.getComboItems().stream()
                .map(Combos::renglon)
                .collect(Collectors.joining(", "));
    }

    public static List<String> incluye(Product combo) {
        if (!esCombo(combo) || combo.getComboItems() == null) return List.of();
        return combo.getComboItems().stream().map(Combos::renglon).toList();
    }

    private static String renglon(ComboItem c) {
        return c.getCantidad() + " × " + c.getProducto().getName();
    }

    private static String unir(List<String> palabras) {
        if (palabras.size() == 1) return palabras.get(0);
        return String.join(", ", palabras.subList(0, palabras.size() - 1)) + " y " + palabras.get(palabras.size() - 1);
    }
}
