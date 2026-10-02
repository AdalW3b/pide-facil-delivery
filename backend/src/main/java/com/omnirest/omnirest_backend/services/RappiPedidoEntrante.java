package com.omnirest.omnirest_backend.services;

import tools.jackson.databind.JsonNode;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

/**
 * Un pedido de Rappi tal como llega en el webhook NEW_ORDER, que trae lo
 * mismo que devuelve GET orders: {@code order_detail}, {@code customer} y
 * {@code store}.
 *
 * Solo lee: no toca la base ni decide nada. Los montos vienen como enteros en
 * la moneda del pais y se toman tal cual.
 */
record RappiPedidoEntrante(
        String orderId,
        /** El id de la tienda en Rappi (store.internal_id). */
        String storeId,
        /** El id que el integrador le dio a la tienda al ligarla (store.external_id). */
        String storeIdExterno,
        /** delivery (repartidor de Rappi), marketplace (repartidor propio) o pickup. */
        String metodoEntrega,
        String metodoPago,
        Integer minutosCocina,
        Integer minutosCocinaMin,
        Integer minutosCocinaMax,
        String cliente,
        String direccion,
        String complemento,
        /** Lo que recibe el restaurante (totals.total_order). */
        BigDecimal totalOrden,
        /** Efectivo que el cliente paga en mostrador o al repartidor propio. Null si no paga en efectivo. */
        BigDecimal efectivoACobrar,
        List<Linea> lineas) {

    record Linea(String sku, String id, String nombre, BigDecimal precio, int cantidad,
                 String comentarios, List<Subitem> subitems) {

        /** Lo que costo una unidad con sus toppings, que es como se guarda el precio en una linea. */
        BigDecimal precioUnitario() {
            BigDecimal total = precio;
            for (Subitem s : subitems) {
                total = total.add(s.precio().multiply(BigDecimal.valueOf(s.cantidad())));
            }
            return total;
        }

        /** "2× Ensalada (Queso extra)", para avisar de lo que no se pudo ligar. */
        String describir() {
            StringBuilder texto = new StringBuilder().append(cantidad).append("× ").append(nombre);
            if (!subitems.isEmpty()) {
                texto.append(" (")
                        .append(String.join(", ", subitems.stream().map(Subitem::describir).toList()))
                        .append(")");
            }
            return texto.toString();
        }
    }

    /** Un topping. La cantidad es por cada unidad del platillo. */
    record Subitem(String sku, String id, String nombre, BigDecimal precio, int cantidad) {
        String describir() {
            return cantidad > 1 ? cantidad + "× " + nombre : nombre;
        }
    }

    /** Lo lleva un repartidor de Rappi. */
    boolean repartoDeRappi() {
        return "delivery".equalsIgnoreCase(metodoEntrega);
    }

    /** El cliente pasa a recogerlo al mostrador. */
    boolean paraRecoger() {
        return "pickup".equalsIgnoreCase(metodoEntrega);
    }

    static RappiPedidoEntrante leer(JsonNode pedido) {
        JsonNode detalle = pedido.path("order_detail");
        String orderId = texto(detalle.path("order_id"));
        if (orderId == null) {
            throw new IllegalArgumentException("El pedido de Rappi no trae order_detail.order_id.");
        }
        JsonNode tienda = pedido.path("store");
        JsonNode totales = detalle.path("totals");
        JsonNode entrega = detalle.path("delivery_information");
        String metodoEntrega = texto(detalle.path("delivery_method"));
        String metodoPago = texto(detalle.path("payment_method"));

        List<Linea> lineas = new ArrayList<>();
        for (JsonNode item : detalle.path("items")) {
            List<Subitem> subitems = new ArrayList<>();
            for (JsonNode sub : item.path("subitems")) {
                subitems.add(new Subitem(texto(sub.path("sku")), texto(sub.path("id")), texto(sub.path("name")),
                        dinero(sub.path("price")), cantidad(sub.path("quantity"))));
            }
            lineas.add(new Linea(texto(item.path("sku")), texto(item.path("id")), texto(item.path("name")),
                    dinero(item.path("price")), cantidad(item.path("quantity")),
                    texto(item.path("comments")), subitems));
        }

        // total_to_pay es el efectivo que se cobra en mostrador o con repartidor
        // propio. Con repartidor de Rappi lo cobra Rappi y al restaurante no le toca.
        BigDecimal efectivo = null;
        if ("cash".equalsIgnoreCase(metodoPago) && !"delivery".equalsIgnoreCase(metodoEntrega)) {
            BigDecimal aPagar = dinero(totales.path("total_to_pay"));
            efectivo = aPagar.signum() > 0 ? aPagar : null;
        }

        return new RappiPedidoEntrante(
                orderId,
                texto(tienda.path("internal_id")),
                texto(tienda.path("external_id")),
                metodoEntrega,
                metodoPago,
                entero(detalle.path("cooking_time")),
                entero(detalle.path("min_cooking_time")),
                entero(detalle.path("max_cooking_time")),
                nombreCliente(pedido.path("customer")),
                texto(entrega.path("complete_address")),
                texto(entrega.path("complement")),
                totales.has("total_order") ? dinero(totales.path("total_order")) : null,
                efectivo,
                lineas);
    }

    /** "John D.": basta para llamarlo en mostrador sin guardar su apellido completo. */
    private static String nombreCliente(JsonNode cliente) {
        String nombre = texto(cliente.path("first_name"));
        String apellido = texto(cliente.path("last_name"));
        if (nombre == null) return apellido;
        if (apellido == null) return nombre;
        return nombre + " " + apellido.charAt(0) + ".";
    }

    /** El valor como texto, o null si falta o viene vacio. Los ids pueden venir como numero. */
    private static String texto(JsonNode nodo) {
        if (nodo == null || nodo.isMissingNode() || nodo.isNull()) return null;
        String valor = nodo.asString().trim();
        return valor.isEmpty() ? null : valor;
    }

    private static Integer entero(JsonNode nodo) {
        return nodo == null || !nodo.isNumber() ? null : nodo.asInt();
    }

    private static int cantidad(JsonNode nodo) {
        return nodo != null && nodo.isNumber() && nodo.asInt() > 0 ? nodo.asInt() : 1;
    }

    private static BigDecimal dinero(JsonNode nodo) {
        if (nodo == null || nodo.isMissingNode() || nodo.isNull()) return BigDecimal.ZERO;
        if (nodo.isNumber()) return nodo.decimalValue();
        try {
            return new BigDecimal(nodo.asString().trim());
        } catch (NumberFormatException e) {
            return BigDecimal.ZERO;
        }
    }
}
