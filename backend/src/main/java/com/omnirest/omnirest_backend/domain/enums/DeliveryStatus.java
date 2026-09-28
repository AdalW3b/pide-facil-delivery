package com.omnirest.omnirest_backend.domain.enums;

/**
 * Avance de la entrega, en paralelo al avance de cocina. Cocina dice si la
 * comida esta lista; esto dice donde va el pedido.
 *
 * El camino es NUEVO -> CONFIRMADO -> LISTO -> EN_CAMINO -> ENTREGADO. Se puede
 * saltar pasos hacia adelante, porque en una cocina real un pedido a veces sale
 * directo sin pasar por el mostrador, pero nunca se retrocede: un pedido que ya
 * salio no vuelve a estar "por confirmar".
 */
public enum DeliveryStatus {

    /** Llego por el enlace del cliente y la sucursal todavia no lo acepta. */
    NUEVO(0),
    /** Aceptado: hasta este momento cocina lo ve en su tablero. */
    CONFIRMADO(1),
    /** Empacado, esperando repartidor. */
    LISTO(2),
    /** El repartidor lo lleva. */
    EN_CAMINO(3),
    ENTREGADO(4),
    /** Rechazado o cancelado. Sale del camino y ya no avanza. */
    CANCELADO(-1);

    private final int paso;

    DeliveryStatus(int paso) {
        this.paso = paso;
    }

    /** Ya no admite mas cambios. */
    public boolean esFinal() {
        return this == ENTREGADO || this == CANCELADO;
    }

    /** True si la comida ya debe aparecer en el tablero de cocina. */
    public boolean llegoACocina() {
        return this != NUEVO && this != CANCELADO;
    }

    /**
     * Si es valido pasar de este estado al que se pide. Cancelar se permite en
     * cualquier punto del camino; lo demas, solo hacia adelante.
     */
    public boolean puedeAvanzarA(DeliveryStatus nuevo) {
        if (nuevo == null || esFinal() || nuevo == this) {
            return false;
        }
        if (nuevo == CANCELADO) {
            return true;
        }
        return nuevo.paso > this.paso;
    }
}
