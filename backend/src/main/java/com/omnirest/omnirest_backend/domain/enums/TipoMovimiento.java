package com.omnirest.omnirest_backend.domain.enums;

/** Por que cambio una existencia. */
public enum TipoMovimiento {
    VENTA,
    CANCELACION,
    /** Llego mercancia. */
    ENTRADA,
    /** Se echo a perder, se tiro o se cancelo ya preparado. */
    MERMA,
    /** Conteo fisico: la diferencia contra lo que decia el sistema. */
    CONTEO,
    /** Correccion a mano del numero. */
    AJUSTE
}
