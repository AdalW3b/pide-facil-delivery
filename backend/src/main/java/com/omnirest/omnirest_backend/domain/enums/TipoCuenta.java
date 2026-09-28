package com.omnirest.omnirest_backend.domain.enums;

/**
 * Quien es el dueno de una cuenta publica. El mismo telefono puede ser las dos
 * cosas en el mismo restaurante: alguien que reparte tambien pide de comer.
 */
public enum TipoCuenta {
    CLIENTE,
    REPARTIDOR;

    /** El permiso que lleva su token, para proteger sus endpoints. */
    public String autoridad() {
        return this == CLIENTE ? "CUENTA_CLIENTE" : "CUENTA_REPARTIDOR";
    }
}
