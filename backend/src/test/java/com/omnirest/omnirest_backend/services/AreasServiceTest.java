package com.omnirest.omnirest_backend.services;

import com.omnirest.omnirest_backend.domain.entities.*;
import com.omnirest.omnirest_backend.domain.enums.KitchenStatus;
import com.omnirest.omnirest_backend.repositories.AreaPreparacionRepository;
import com.omnirest.omnirest_backend.repositories.BranchRepository;
import com.omnirest.omnirest_backend.repositories.CategoryRepository;
import com.omnirest.omnirest_backend.repositories.ProductRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** A qué área va cada platillo y qué nace listo. */
class AreasServiceTest {

    private final AreaPreparacionRepository areaRepository = mock(AreaPreparacionRepository.class);
    private final CategoryRepository categorias = mock(CategoryRepository.class);
    private final ProductRepository productos = mock(ProductRepository.class);
    private final BranchRepository branches = mock(BranchRepository.class);
    private AreasService servicio;

    private final Restaurant restaurante = Restaurant.builder().id(UUID.randomUUID()).name("JA TechCode").build();
    private AreaPreparacion cocina;
    private AreaPreparacion barra;
    private AreaPreparacion postres;
    private AreaPreparacion empaque;

    @BeforeEach
    void setUp() {
        servicio = new AreasService(areaRepository, categorias, productos, branches);
        cocina = area("Cocina", AreaPreparacion.PREPARACION, true);
        barra = area("Barra", AreaPreparacion.PREPARACION, false);
        postres = area("Postres", AreaPreparacion.PREPARACION, false);
        empaque = area("Empaque", AreaPreparacion.EMPAQUE, false);
        when(areaRepository.findByRestaurantIdOrderByOrdenAscNombreAsc(restaurante.getId()))
                .thenReturn(List.of(cocina, barra, postres, empaque));
    }

    private AreaPreparacion area(String nombre, String tipo, boolean predeterminada) {
        return AreaPreparacion.builder().id(UUID.randomUUID()).restaurantId(restaurante.getId()).nombre(nombre)
                .tipo(tipo).predeterminada(predeterminada).build();
    }

    private OrderItem pedir(Product p) {
        OrderItem item = OrderItem.builder().product(p).quantity(1).build();
        servicio.asignar(item);
        return item;
    }

    private Product producto(String nombre, UUID areaCategoria, UUID areaProducto, boolean sinPreparacion) {
        Category c = Category.builder().id(UUID.randomUUID()).name("x").restaurant(restaurante).areaId(areaCategoria).build();
        return Product.builder().id(UUID.randomUUID()).name(nombre).category(c).areaId(areaProducto).sinPreparacion(sinPreparacion).build();
    }

    @Test
    @DisplayName("Va al área del producto, si no a la de su categoría, si no a Cocina")
    void areaDeCadaPlatillo() {
        assertEquals(barra.getId(), pedir(producto("Agua de horchata", barra.getId(), null, false)).getAreaId());
        assertEquals(postres.getId(), pedir(producto("Café de olla", barra.getId(), postres.getId(), false)).getAreaId(),
                "la excepción del producto gana");
        assertEquals(cocina.getId(), pedir(producto("Taco al pastor", null, null, false)).getAreaId());
    }

    @Test
    @DisplayName("Un área apagada o de empaque no recibe platillos: van a la predeterminada")
    void areaApagada() {
        barra.setActiva(false);
        assertEquals(cocina.getId(), pedir(producto("Limonada", barra.getId(), null, false)).getAreaId());
        assertEquals(cocina.getId(), pedir(producto("Raro", empaque.getId(), null, false)).getAreaId());
    }

    @Test
    @DisplayName("Un refresco nace listo; lo demás, pendiente")
    void sinPreparacion() {
        OrderItem coca = pedir(producto("Coca-Cola 355 ml", barra.getId(), null, true));
        assertEquals(KitchenStatus.READY, coca.getKitchenStatus());
        assertNotNull(coca.getReadyAt());
        assertEquals(KitchenStatus.PENDING, pedir(producto("Horchata", barra.getId(), null, false)).getKitchenStatus());
    }

    @Test
    @DisplayName("Un restaurante nuevo recibe Cocina, Parrilla, Barra, Postres y Empaque")
    void areasDeSiempre() {
        UUID nuevo = UUID.randomUUID();
        when(areaRepository.findByRestaurantIdOrderByOrdenAscNombreAsc(nuevo)).thenReturn(List.of());
        when(areaRepository.saveAll(anyList())).thenAnswer(i -> new ArrayList<>(i.<List<AreaPreparacion>>getArgument(0)));
        var areas = servicio.areas(nuevo);
        assertEquals(List.of("Cocina", "Parrilla", "Barra", "Postres", "Empaque"),
                areas.stream().map(AreasService.Area::nombre).toList());
        assertTrue(areas.get(0).predeterminada());
        assertEquals(AreaPreparacion.EMPAQUE, areas.get(4).tipo());
    }

    @Test
    @DisplayName("La predeterminada no se apaga, y a una categoría no se le asigna Empaque")
    void reglas() {
        when(areaRepository.findById(cocina.getId())).thenReturn(Optional.of(cocina));
        assertThrows(IllegalStateException.class, () -> servicio.activar(restaurante.getId(), cocina.getId(), false));

        Category bebidas = Category.builder().id(UUID.randomUUID()).name("Bebidas").restaurant(restaurante).build();
        when(categorias.findByIdAndRestaurantId(bebidas.getId(), restaurante.getId())).thenReturn(Optional.of(bebidas));
        assertThrows(IllegalArgumentException.class, () -> servicio.guardarAsignacion(restaurante.getId(),
                new AreasService.GuardarAsignacion(
                        List.of(new AreasService.CategoriaArea(bebidas.getId(), "Bebidas", empaque.getId())), null)));
    }
}
