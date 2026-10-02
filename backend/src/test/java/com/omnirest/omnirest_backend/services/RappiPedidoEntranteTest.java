package com.omnirest.omnirest_backend.services;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.io.InputStream;
import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.*;

/** Lectura del pedido de ejemplo de la documentacion de Rappi (GET orders / NEW_ORDER). */
class RappiPedidoEntranteTest {

    private static final JsonMapper JSON = JsonMapper.builder().build();

    private static JsonNode ejemplo() throws Exception {
        try (InputStream in = RappiPedidoEntranteTest.class.getResourceAsStream("/rappi/new-order-ejemplo.json")) {
            return JSON.readTree(in);
        }
    }

    private static RappiPedidoEntrante leer(String json) {
        return RappiPedidoEntrante.leer(JSON.readTree(json));
    }

    @Test
    @DisplayName("Lee el pedido, la tienda, el cliente y la entrega")
    void leeElEjemplo() throws Exception {
        RappiPedidoEntrante p = RappiPedidoEntrante.leer(ejemplo());

        assertEquals("392625", p.orderId());
        assertEquals("30000011", p.storeId());
        assertEquals("123445", p.storeIdExterno());
        assertEquals("delivery", p.metodoEntrega());
        assertEquals("cc", p.metodoPago());
        assertTrue(p.repartoDeRappi());
        assertFalse(p.paraRecoger());
        assertEquals(10, p.minutosCocina());
        assertEquals(5, p.minutosCocinaMin());
        assertEquals(20, p.minutosCocinaMax());
        assertEquals("John D.", p.cliente());
        assertEquals("Portón verde", p.complemento());
        assertTrue(p.direccion().startsWith("Nombre de la calle 5050"));
        assertEquals(0, new BigDecimal("204180").compareTo(p.totalOrden()));
        assertNull(p.efectivoACobrar(), "pagado con tarjeta: no hay efectivo que cobrar");
    }

    @Test
    @DisplayName("Los platillos traen precio unitario con sus toppings")
    void lineasYToppings() throws Exception {
        RappiPedidoEntrante p = RappiPedidoEntrante.leer(ejemplo());
        assertEquals(2, p.lineas().size());

        RappiPedidoEntrante.Linea ensalada = p.lineas().get(0);
        assertEquals("1234", ensalada.sku());
        assertEquals("Chicken and Apple Salad", ensalada.nombre());
        assertEquals(3, ensalada.cantidad());
        assertEquals("No vinegar", ensalada.comentarios());
        assertEquals(1, ensalada.subitems().size());
        assertEquals("11", ensalada.subitems().get(0).sku());
        // 28900 + 13500 de burrata
        assertEquals(0, new BigDecimal("42400").compareTo(ensalada.precioUnitario()));

        RappiPedidoEntrante.Linea mariscos = p.lineas().get(1);
        assertNull(mariscos.sku(), "la segunda linea no trae sku");
        assertNull(mariscos.comentarios(), "comentario vacio = null");
        // 34900 + 0 + 3500
        assertEquals(0, new BigDecimal("38400").compareTo(mariscos.precioUnitario()));
        assertEquals("2× Seafood Salad (With white vinaigrette, Ricotta Cheese)", mariscos.describir());
    }

    @Test
    @DisplayName("Efectivo: se cobra en mostrador o con repartidor propio, no con el de Rappi")
    void efectivoSegunQuienEntrega() {
        String plantilla = """
                {"order_detail": {"order_id": "1", "delivery_method": "%s", "payment_method": "cash",
                  "totals": {"total_order": 250, "total_to_pay": 250}, "items": []},
                 "store": {"internal_id": "9"}}
                """;
        assertEquals(0, new BigDecimal("250").compareTo(leer(plantilla.formatted("pickup")).efectivoACobrar()));
        assertEquals(0, new BigDecimal("250").compareTo(leer(plantilla.formatted("marketplace")).efectivoACobrar()));
        assertNull(leer(plantilla.formatted("delivery")).efectivoACobrar());
        assertTrue(leer(plantilla.formatted("pickup")).paraRecoger());
    }

    @Test
    @DisplayName("Tolera ids numericos, cantidades faltantes y montos con decimales")
    void tolerante() {
        RappiPedidoEntrante p = leer("""
                {"order_detail": {"order_id": 777, "items": [
                   {"sku": 55, "name": "Taco", "price": 25.5, "subitems": [{"name": "Queso", "price": "10"}]}
                 ]},
                 "customer": {"first_name": "Ana"},
                 "store": {"internal_id": 9}}
                """);
        assertEquals("777", p.orderId());
        assertEquals("9", p.storeId());
        assertEquals("Ana", p.cliente());
        RappiPedidoEntrante.Linea taco = p.lineas().get(0);
        assertEquals("55", taco.sku());
        assertEquals(1, taco.cantidad());
        assertEquals(0, new BigDecimal("35.5").compareTo(taco.precioUnitario()));
        assertNull(p.totalOrden());
    }

    @Test
    @DisplayName("Sin order_id no es un pedido")
    void exigeOrderId() {
        assertThrows(IllegalArgumentException.class, () -> leer("{\"order_detail\": {}}"));
    }
}
