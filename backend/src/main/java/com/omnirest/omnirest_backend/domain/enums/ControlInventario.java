package com.omnirest.omnirest_backend.domain.enums;

/** Que hace la sucursal cuando una venta necesita mas de lo que hay en inventario. */
public enum ControlInventario {
    /** Vende y deja el numero en negativo; se avisa al gerente. */
    AVISAR,
    /** No deja vender lo que no alcanza. */
    BLOQUEAR,
    /** Las ventas no descuentan nada. */
    APAGADO
}
