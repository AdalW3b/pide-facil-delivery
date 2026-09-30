package com.omnirest.omnirest_backend.dtos;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

/**
 * Lo que el bot necesita del carrito: los platillos, el total y un texto listo
 * para mandarle al cliente. El bot debe usar este texto para el resumen, no lo
 * que recuerde la IA: es lo que de verdad se va a mandar a cocina.
 */
public record CarritoBotDTO(
        boolean vacio,
        Integer mesa,
        List<Linea> items,
        BigDecimal total,
        /** "1 × Agua de horchata — $45.00\n1 × Tlayuda de cecina — $145.00\nTotal: $190.00" */
        String texto,
        /** Platillos que el bot pidio y no existen en el menu: hay que preguntarle al cliente. */
        List<String> noEncontrados,
        /** Adicionales que no se reconocieron; el platillo si se agrego. */
        List<String> avisos
) {
    public record Linea(
            UUID id,
            String producto,
            int cantidad,
            List<String> adicionales,
            String instrucciones,
            BigDecimal precioUnitario,
            BigDecimal subtotal
    ) {}

    /** Resultado de confirmar: si se mando a cocina y que se mando. */
    public record Confirmacion(boolean enviado, String mensaje, CarritoBotDTO enviadoACocina) {}

    /** Para agregar: la mesa (si se sabe) y los platillos por nombre, como en /orders/items. */
    public record Agregar(Integer tableNumber, List<WebhookOrderItemDTO> items) {}

    /**
     * Para quitar: el nombre y cuantos (sin cantidad se quita todo ese platillo).
     * Para quitar varios de una vez, la lista en items con el mismo formato.
     */
    public record Quitar(String product_name, Integer quantity, List<Quitar> items) {
        public Quitar(String product_name, Integer quantity) {
            this(product_name, quantity, null);
        }
    }

    public record Confirmar(Integer tableNumber) {}
}
