package com.omnirest.omnirest_backend.services;

import com.omnirest.omnirest_backend.domain.entities.Ingredient;
import com.omnirest.omnirest_backend.domain.entities.PreparacionComponente;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Map;
import java.util.UUID;

/**
 * Cuanto se puede usar de un ingrediente para vender: lo que hay y, si es una
 * preparacion que se prepara sola al vender, lo que alcanza a prepararse con
 * sus ingredientes. Lo usan los agotados y las porciones del catalogo, para
 * que coincidan con lo que de verdad deja vender {@link InventoryService}.
 */
final class Disponible {

    private Disponible() {
    }

    static boolean sePreparaAlVender(Ingredient i) {
        return i != null && Boolean.TRUE.equals(i.getEsPreparado()) && Boolean.TRUE.equals(i.getPrepararAlVender())
                && i.getRinde() != null && i.getRinde().signum() > 0
                && i.getComponentes() != null && !i.getComponentes().isEmpty();
    }

    static BigDecimal de(Ingredient i, Map<UUID, BigDecimal> existencias) {
        return de(i, existencias, 0);
    }

    /** Un componente que tambien se prepara solo cuenta lo que alcanza a prepararse de el. */
    private static BigDecimal de(Ingredient i, Map<UUID, BigDecimal> existencias, int nivel) {
        BigDecimal hay = existencias.getOrDefault(i.getId(), BigDecimal.ZERO);
        if (!sePreparaAlVender(i) || nivel >= Costos.NIVELES) return hay;
        BigDecimal tandas = null;
        for (PreparacionComponente c : i.getComponentes()) {
            BigDecimal porTanda = Costos.enUnidadDe(c);
            if (porTanda == null || porTanda.signum() <= 0) continue;
            BigDecimal alcanza = de(c.getComponente(), existencias, nivel + 1)
                    .max(BigDecimal.ZERO).divide(porTanda, 6, RoundingMode.DOWN);
            tandas = tandas == null ? alcanza : tandas.min(alcanza);
        }
        if (tandas == null) return hay;
        return hay.max(BigDecimal.ZERO).add(tandas.multiply(i.getRinde()));
    }
}
