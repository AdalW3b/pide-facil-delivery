package com.omnirest.omnirest_backend.services;

import com.omnirest.omnirest_backend.domain.entities.*;
import com.omnirest.omnirest_backend.dtos.CarritoBotDTO;
import com.omnirest.omnirest_backend.dtos.WebhookOrderItemDTO;
import com.omnirest.omnirest_backend.dtos.WebhookOrderRequestDTO;
import com.omnirest.omnirest_backend.repositories.BranchRepository;
import com.omnirest.omnirest_backend.repositories.CarritoBotRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * La conversacion que fallo: "Quiero agua de horchata" -> "Si, aparte una
 * tlayuda" -> "Si". La IA solo mandaba la tlayuda; con el carrito, al
 * confirmar va todo lo que el cliente pidio.
 */
class CarritoBotServiceTest {

    private final UUID branchId = UUID.randomUUID();
    private final String telefono = "5215512345678";

    private final Restaurant restaurante = Restaurant.builder().id(UUID.randomUUID()).name("Prueba").build();
    private final Category bebidas = Category.builder().id(UUID.randomUUID()).name("Bebidas").restaurant(restaurante).build();
    private final Product horchata = Product.builder().id(UUID.randomUUID()).name("Agua de horchata 1 L")
            .price(new BigDecimal("45.00")).category(bebidas).build();
    private final Product tlayuda = Product.builder().id(UUID.randomUUID()).name("Tlayuda de cecina")
            .price(new BigDecimal("145.00")).category(bebidas).build();

    private final CarritoBotRepository carritoRepository = mock(CarritoBotRepository.class);
    private final BranchRepository branchRepository = mock(BranchRepository.class);
    private final OrderService orderService = mock(OrderService.class);
    private final AdicionalesService adicionalesService = mock(AdicionalesService.class);
    private final AgotadosService agotadosService = mock(AgotadosService.class);
    private final AtomicReference<CarritoBot> guardado = new AtomicReference<>();

    private CarritoBotService servicio;

    @BeforeEach
    void setUp() {
        servicio = new CarritoBotService(carritoRepository, branchRepository, orderService, adicionalesService, agotadosService);
        when(branchRepository.findById(branchId)).thenReturn(Optional.of(
                Branch.builder().id(branchId).restaurant(restaurante).build()));
        when(orderService.encontrarProducto(eq(restaurante.getId()), argThat((String n) -> n != null && n.toLowerCase().contains("horchata")))).thenReturn(horchata);
        when(orderService.encontrarProducto(eq(restaurante.getId()), argThat((String n) -> n != null && n.toLowerCase().contains("tlayuda")))).thenReturn(tlayuda);
        when(orderService.encontrarProducto(eq(restaurante.getId()), argThat((String n) -> n != null && n.toLowerCase().contains("pizza"))))
                .thenReturn(null);
        when(adicionalesService.gruposActivos(any())).thenReturn(List.of());
        when(adicionalesService.resolverPorNombre(any(), any(), any())).thenReturn(
                new AdicionalesService.EleccionBot(new AdicionalesService.Eleccion(BigDecimal.ZERO, List.of()), List.of()));
        doAnswer(i -> {
            OrderItem item = i.getArgument(0);
            item.setUnitPrice(item.getProduct().getPrice());
            return null;
        }).when(adicionalesService).aplicarALinea(any(), any());

        // El repositorio guarda un solo carrito en memoria.
        when(carritoRepository.findByBranchIdAndTelefono(branchId, TelefonoMx.canonico(telefono)))
                .thenAnswer(i -> Optional.ofNullable(guardado.get()));
        when(carritoRepository.save(any(CarritoBot.class))).thenAnswer(i -> {
            CarritoBot c = i.getArgument(0);
            guardado.set(c);
            return c;
        });
        doAnswer(i -> {
            guardado.set(null);
            return null;
        }).when(carritoRepository).delete(any(CarritoBot.class));
    }

    private CarritoBotDTO agregar(String nombre, int cantidad) {
        return servicio.agregar(branchId, telefono, new CarritoBotDTO.Agregar(1,
                List.of(new WebhookOrderItemDTO(nombre, cantidad, null, List.of()))));
    }

    @Test
    @DisplayName("Horchata en un mensaje y tlayuda en otro: al confirmar van los dos a cocina")
    void confirmarMandaTodoLoDelCarrito() {
        agregar("Agua de horchata", 1);
        CarritoBotDTO resumen = agregar("Tlayuda de cecina", 1);

        assertEquals(2, resumen.items().size());
        assertEquals(0, resumen.total().compareTo(new BigDecimal("190.00")));
        assertTrue(resumen.texto().contains("Agua de horchata") && resumen.texto().contains("Tlayuda de cecina"),
                resumen.texto());
        assertTrue(resumen.texto().endsWith("Total: $190.00"), resumen.texto());

        CarritoBotDTO.Confirmacion confirmacion = servicio.confirmar(branchId, telefono, new CarritoBotDTO.Confirmar(1));

        assertTrue(confirmacion.enviado());
        ArgumentCaptor<WebhookOrderRequestDTO> aCocina = ArgumentCaptor.forClass(WebhookOrderRequestDTO.class);
        verify(orderService).addWebhookItems(aCocina.capture());
        assertEquals(List.of("Agua de horchata 1 L", "Tlayuda de cecina"),
                aCocina.getValue().items().stream().map(WebhookOrderItemDTO::product_name).toList());
        assertNull(guardado.get(), "después de confirmar el carrito queda vacío");
    }

    @Test
    @DisplayName("Pedir otra horchata suma a la misma línea")
    void mismoPlatilloSeSuma() {
        agregar("Agua de horchata", 1);
        CarritoBotDTO resumen = agregar("agua de horchata", 2);
        assertEquals(1, resumen.items().size());
        assertEquals(3, resumen.items().get(0).cantidad());
    }

    @Test
    @DisplayName("Un platillo que no existe no se agrega y se reporta")
    void platilloInexistenteSeReporta() {
        agregar("Agua de horchata", 1);
        CarritoBotDTO resumen = agregar("pizza hawaiana", 1);
        assertEquals(List.of("pizza hawaiana"), resumen.noEncontrados());
        assertEquals(1, resumen.items().size());
    }

    @Test
    @DisplayName("Quitar la tlayuda deja solo la horchata")
    void quitarPlatillo() {
        agregar("Agua de horchata", 1);
        agregar("Tlayuda de cecina", 1);
        CarritoBotDTO resumen = servicio.quitar(branchId, telefono, new CarritoBotDTO.Quitar("tlayuda", null));
        assertEquals(List.of("Agua de horchata 1 L"), resumen.items().stream().map(CarritoBotDTO.Linea::producto).toList());
    }

    @Test
    @DisplayName("Quitar varios platillos en una sola petición")
    void quitarVarios() {
        agregar("Agua de horchata", 2);
        agregar("Tlayuda de cecina", 1);
        CarritoBotDTO resumen = servicio.quitar(branchId, telefono, new CarritoBotDTO.Quitar(null, null, List.of(
                new CarritoBotDTO.Quitar("horchata", 1), new CarritoBotDTO.Quitar("tlayuda", null))));
        assertEquals(1, resumen.items().size());
        assertEquals(1, resumen.items().get(0).cantidad());
    }

    @Test
    @DisplayName("Confirmar sin nada en el carrito no manda nada a cocina")
    void confirmarCarritoVacio() {
        CarritoBotDTO.Confirmacion confirmacion = servicio.confirmar(branchId, telefono, new CarritoBotDTO.Confirmar(1));
        assertFalse(confirmacion.enviado());
        verify(orderService, never()).addWebhookItems(any());
    }

    @Test
    @DisplayName("Si cocina rechaza el pedido, el carrito se conserva")
    void siFallaSeConservaElCarrito() {
        agregar("Tlayuda de cecina", 1);
        doThrow(new IllegalStateException("Stock insuficiente")).when(orderService).addWebhookItems(any());
        assertThrows(IllegalStateException.class,
                () -> servicio.confirmar(branchId, telefono, new CarritoBotDTO.Confirmar(1)));
        assertNotNull(guardado.get());
    }
}
