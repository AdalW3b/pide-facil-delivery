package com.omnirest.omnirest_backend.services;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Las cuentas del arqueo: cuanto efectivo deberia haber en el cajon y cuanto
 * suma lo que se conto. Sin base de datos, para poder probarlas solas.
 */
final class ArqueoCaja {

    /** Billetes y monedas de pesos que se cuentan. El 20 existe en billete y en moneda: se cuentan juntos. */
    static final List<String> DENOMINACIONES = List.of("1000", "500", "200", "100", "50", "20", "10", "5", "2", "1", "0.5");
    private static final Set<String> VALIDAS = Set.copyOf(DENOMINACIONES);

    private ArqueoCaja() {
    }

    /**
     * Lo que deberia haber en el cajon al cerrar:
     * fondo + cobros en efectivo (con su propina) + entradas - salidas + lo
     * que entregaron los repartidores en su corte.
     */
    static BigDecimal esperado(BigDecimal fondo, BigDecimal cobrosEfectivo, BigDecimal propinasEfectivo,
                               BigDecimal entradas, BigDecimal salidas, BigDecimal cortes) {
        return cero(fondo)
                .add(cero(cobrosEfectivo))
                .add(cero(propinasEfectivo))
                .add(cero(entradas))
                .subtract(cero(salidas))
                .add(cero(cortes))
                .setScale(2, RoundingMode.HALF_UP);
    }

    /** Suma de billetes y monedas. Rechaza denominaciones que no existen y piezas negativas. */
    static BigDecimal totalConteo(Map<String, Integer> conteo) {
        BigDecimal total = BigDecimal.ZERO;
        for (Map.Entry<String, Integer> e : conteo.entrySet()) {
            String denominacion = normalizar(e.getKey());
            if (!VALIDAS.contains(denominacion)) {
                throw new IllegalArgumentException("No existe la denominación de $" + e.getKey() + ".");
            }
            int piezas = e.getValue() == null ? 0 : e.getValue();
            if (piezas < 0) {
                throw new IllegalArgumentException("Las piezas de $" + e.getKey() + " no pueden ser negativas.");
            }
            total = total.add(new BigDecimal(denominacion).multiply(BigDecimal.valueOf(piezas)));
        }
        return total.setScale(2, RoundingMode.HALF_UP);
    }

    /** "500.00" y "500" son lo mismo; ".5" y "0.50" tambien. */
    static String normalizar(String denominacion) {
        if (denominacion == null) return "";
        try {
            return new BigDecimal(denominacion.trim()).stripTrailingZeros().toPlainString();
        } catch (NumberFormatException e) {
            return denominacion.trim();
        }
    }

    private static BigDecimal cero(BigDecimal valor) {
        return valor != null ? valor : BigDecimal.ZERO;
    }
}
