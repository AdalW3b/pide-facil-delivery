package com.omnirest.omnirest_backend.services;

import com.omnirest.omnirest_backend.domain.entities.Adicional;
import com.omnirest.omnirest_backend.domain.entities.Category;
import com.omnirest.omnirest_backend.domain.entities.GrupoAdicional;
import com.omnirest.omnirest_backend.domain.entities.Ingredient;
import com.omnirest.omnirest_backend.domain.entities.OrderItem;
import com.omnirest.omnirest_backend.domain.entities.Product;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

/** La regla con la que se cobran los adicionales. No toca la base. */
class AdicionalesServiceTest {

    private final AdicionalesService servicio = new AdicionalesService(null, null, null, null);

    private Product taco;
    private Product agua;
    private List<GrupoAdicional> grupos;
    private Adicional maiz, harina, carne, queso, guacamole;
    private Ingredient pastor;

    @BeforeEach
    void setUp() {
        Category tacos = Category.builder().id(UUID.randomUUID()).name("Tacos").build();
        Category bebidas = Category.builder().id(UUID.randomUUID()).name("Bebidas").build();
        taco = Product.builder().id(UUID.randomUUID()).name("Taco").price(new BigDecimal("99")).category(tacos).build();
        agua = Product.builder().id(UUID.randomUUID()).name("Agua").price(new BigDecimal("45")).category(bebidas).build();
        pastor = Ingredient.builder().id(UUID.randomUUID()).name("Pastor").build();

        GrupoAdicional tortilla = grupo("Tortilla", 1, 1, tacos);
        maiz = opcion(tortilla, "Maíz", "0", true);
        harina = opcion(tortilla, "Harina", "5", true);

        GrupoAdicional extras = grupo("Extras", 0, 2, tacos);
        carne = opcion(extras, "Carne extra", "25", true);
        carne.setIngrediente(pastor);
        carne.setCantidadIngrediente(new BigDecimal("0.080"));
        queso = opcion(extras, "Queso", "15", true);
        guacamole = opcion(extras, "Guacamole", "20", false);

        grupos = List.of(tortilla, extras);
    }

    @Test
    @DisplayName("Suma los adicionales al precio y congela nombre, precio e ingrediente")
    void resolver_sumaYCongela() {
        var eleccion = servicio.resolver(taco, List.of(harina.getId(), carne.getId()), grupos);

        assertEquals(new BigDecimal("30"), eleccion.precioExtra());
        assertEquals(2, eleccion.desglose().size());
        var carneCongelada = eleccion.desglose().stream().filter(a -> a.getNombre().equals("Carne extra")).findFirst().orElseThrow();
        assertEquals(pastor.getId(), carneCongelada.getIngredientId());
        assertEquals(new BigDecimal("0.080"), carneCongelada.getCantidadIngrediente());
    }

    @Test
    @DisplayName("aplicarALinea deja el precio unitario con los adicionales dentro")
    void aplicarALinea_precioUnitarioIncluyeAdicionales() {
        OrderItem item = OrderItem.builder().product(taco).quantity(2).unitPrice(taco.getPrice()).build();
        servicio.aplicarALinea(item, servicio.resolver(taco, List.of(harina.getId(), queso.getId()), grupos));

        assertEquals(new BigDecimal("119"), item.getUnitPrice());
        assertEquals(List.of("Tortilla: Harina", "Extras: Queso"), item.adicionalesParaMostrar());
    }

    @Test
    @DisplayName("Rechaza si falta una eleccion obligatoria")
    void resolver_faltaObligatorio() {
        var e = assertThrows(IllegalArgumentException.class,
                () -> servicio.resolver(taco, List.of(carne.getId()), grupos));
        assertTrue(e.getMessage().contains("tortilla"));
    }

    @Test
    @DisplayName("Rechaza mas opciones de las permitidas en un grupo")
    void resolver_pasaDelMaximo() {
        assertThrows(IllegalArgumentException.class,
                () -> servicio.resolver(taco, List.of(maiz.getId(), harina.getId()), grupos));
    }

    @Test
    @DisplayName("Rechaza un adicional agotado")
    void resolver_agotado() {
        assertThrows(IllegalStateException.class,
                () -> servicio.resolver(taco, List.of(maiz.getId(), guacamole.getId()), grupos));
    }

    @Test
    @DisplayName("Rechaza un adicional que no es de ese platillo")
    void resolver_adicionalAjeno() {
        assertThrows(IllegalArgumentException.class,
                () -> servicio.resolver(agua, List.of(carne.getId()), grupos));
    }

    @Test
    @DisplayName("Un platillo sin grupos no suma nada")
    void resolver_sinGrupos() {
        var eleccion = servicio.resolver(agua, null, grupos);
        assertEquals(BigDecimal.ZERO, eleccion.precioExtra());
        assertTrue(eleccion.desglose().isEmpty());
    }

    @Test
    @DisplayName("Bot: reconoce nombres sin importar acentos ni mayusculas")
    void porNombre_toleraAcentos() {
        var r = servicio.resolverPorNombre(taco, List.of("maiz", "CARNE EXTRA "), grupos);
        assertEquals(new BigDecimal("25"), r.eleccion().precioExtra());
        assertTrue(r.avisos().isEmpty(), r.avisos().toString());
    }

    @Test
    @DisplayName("Bot: lo que no reconoce no tumba el pedido, se vuelve aviso")
    void porNombre_avisaEnVezDeRechazar() {
        var r = servicio.resolverPorNombre(taco, List.of("Salsa verde", "Guacamole", "Queso", "Carne extra", "Harina", "Maíz"), grupos);

        // Cobra harina (la primera de tortilla) y dos extras; lo demas, aviso.
        assertEquals(new BigDecimal("45"), r.eleccion().precioExtra());
        assertEquals(3, r.avisos().size(), r.avisos().toString()); // salsa, guacamole y el segundo tipo de tortilla
        assertTrue(r.avisos().stream().anyMatch(a -> a.contains("Salsa verde")));
        assertTrue(r.avisos().stream().anyMatch(a -> a.contains("Guacamole") && a.contains("agotado")));
    }

    @Test
    @DisplayName("Bot: si falta una eleccion obligatoria, avisa a cocina")
    void porNombre_faltaObligatorio() {
        var r = servicio.resolverPorNombre(taco, List.of(), grupos);
        assertEquals(List.of("Falta elegir tortilla"), r.avisos());
    }

    private static GrupoAdicional grupo(String nombre, int min, int max, Category categoria) {
        return GrupoAdicional.builder().id(UUID.randomUUID()).nombre(nombre).minimo(min).maximo(max)
                .activo(true).categorias(Set.of(categoria)).productos(Set.of()).build();
    }

    private static Adicional opcion(GrupoAdicional grupo, String nombre, String precio, boolean activo) {
        Adicional a = Adicional.builder().id(UUID.randomUUID()).grupo(grupo).nombre(nombre)
                .precio(new BigDecimal(precio)).activo(activo).build();
        grupo.getOpciones().add(a);
        return a;
    }
}
