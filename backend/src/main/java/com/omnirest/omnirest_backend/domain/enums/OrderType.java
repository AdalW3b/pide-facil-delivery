package com.omnirest.omnirest_backend.domain.enums;

/**
 * Como se sirve el pedido. Hasta la migracion V8 todo era SALON; los otros dos
 * no tienen mesa y por eso {@code Order.table} ya es opcional.
 */
public enum OrderType {
    SALON,
    DOMICILIO,
    PARA_LLEVAR
}
