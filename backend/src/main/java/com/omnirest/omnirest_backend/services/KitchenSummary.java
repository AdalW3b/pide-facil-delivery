package com.omnirest.omnirest_backend.services;

import com.omnirest.omnirest_backend.domain.entities.OrderItem;
import com.omnirest.omnirest_backend.domain.enums.KitchenStatus;

import java.util.Collection;

/**
 * Resume en un solo estado como va la cocina de una orden, para poder pintar la
 * mesa con ese color sin que el tablero tenga que mirar platillo por platillo.
 */
public final class KitchenSummary {

    private KitchenSummary() {
    }

    /**
     * Devuelve el estado MENOS avanzado entre los platillos vivos de la orden.
     * Mientras quede uno pendiente la mesa se ve pendiente, y solo cuando todos
     * llegan a un estado la mesa lo refleja. Los cancelados no cuentan.
     * Devuelve null si la orden no tiene platillos vivos.
     */
    public static KitchenStatus resumir(Collection<OrderItem> items) {
        if (items == null) {
            return null;
        }
        KitchenStatus menor = null;
        for (OrderItem item : items) {
            if (item == null) {
                continue;
            }
            KitchenStatus actual = item.getKitchenStatus();
            if (actual == null || actual == KitchenStatus.CANCELLED) {
                continue;
            }
            if (menor == null || avance(actual) < avance(menor)) {
                menor = actual;
            }
        }
        return menor;
    }

    /**
     * True cuando todos los platillos vivos ya llegaron al estado indicado o lo
     * pasaron. Es la condicion para avisarle al comensal una sola vez por etapa,
     * en lugar de un mensaje por platillo.
     */
    public static boolean todosAlcanzaron(Collection<OrderItem> items, KitchenStatus estado) {
        KitchenStatus resumen = resumir(items);
        return resumen != null && avance(resumen) >= avance(estado);
    }

    /**
     * True cuando la etapa alcanzada va mas adelante que la ultima ya avisada.
     * Con esto, agregar un platillo a un pedido que ya estaba en preparacion no
     * vuelve a disparar el mismo mensaje.
     */
    public static boolean esAvisoNuevo(KitchenStatus alcanzada, String yaAvisada) {
        if (alcanzada == null) {
            return false;
        }
        if (yaAvisada == null || yaAvisada.isBlank()) {
            return true;
        }
        try {
            return avance(alcanzada) > avance(KitchenStatus.valueOf(yaAvisada));
        } catch (IllegalArgumentException e) {
            // Valor desconocido en la base: se trata como si no se hubiera avisado.
            return true;
        }
    }

    private static int avance(KitchenStatus estado) {
        switch (estado) {
            case PENDING:
                return 0;
            case PREPARING:
                return 1;
            case READY:
                return 2;
            case DELIVERED:
                return 3;
            default:
                return 4;
        }
    }
}
