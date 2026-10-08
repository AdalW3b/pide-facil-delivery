package com.omnirest.omnirest_backend.services;

import com.omnirest.omnirest_backend.domain.entities.Branch;
import com.omnirest.omnirest_backend.domain.entities.MarcaRestaurante;
import com.omnirest.omnirest_backend.domain.entities.Restaurant;
import com.omnirest.omnirest_backend.repositories.BranchRepository;
import com.omnirest.omnirest_backend.repositories.MarcaRestauranteRepository;
import com.omnirest.omnirest_backend.repositories.RestaurantRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/** Nombre, color y logo del restaurante. */
class MarcaServiceTest {

    private final UUID restaurantId = UUID.randomUUID();
    private final Restaurant restaurante = Restaurant.builder().id(restaurantId).name("Tacos El Farolito").build();

    private final MarcaRestauranteRepository marcaRepository = mock(MarcaRestauranteRepository.class);
    private final RestaurantRepository restaurantRepository = mock(RestaurantRepository.class);
    private final BranchRepository branchRepository = mock(BranchRepository.class);
    private final Map<UUID, MarcaRestaurante> guardadas = new HashMap<>();

    private MarcaService servicio;

    @BeforeEach
    void setUp() {
        servicio = new MarcaService(marcaRepository, restaurantRepository, branchRepository);
        when(restaurantRepository.findById(restaurantId)).thenReturn(Optional.of(restaurante));
        when(restaurantRepository.existsById(restaurantId)).thenReturn(true);
        when(marcaRepository.findById(restaurantId)).thenAnswer(i -> Optional.ofNullable(guardadas.get(restaurantId)));
        when(marcaRepository.save(any(MarcaRestaurante.class))).thenAnswer(i -> {
            MarcaRestaurante m = i.getArgument(0);
            guardadas.put(m.getRestaurantId(), m);
            return m;
        });
        when(marcaRepository.datos(restaurantId)).thenAnswer(i -> Optional.ofNullable(guardadas.get(restaurantId))
                .map(m -> new MarcaRestauranteRepository.Datos() {
                    public String getNombre() { return m.getNombre(); }
                    public String getColor() { return m.getColor(); }
                    public LocalDateTime getLogoVersion() { return m.getLogoVersion(); }
                }));
    }

    @Test
    @DisplayName("Sin marca guardada se ve el nombre del restaurante y los colores de siempre")
    void porDefecto() {
        MarcaService.Marca m = servicio.deRestaurante(restaurantId);
        assertEquals("Tacos El Farolito", m.nombre());
        assertNull(m.nombrePropio());
        assertNull(m.color());
        assertNull(m.logoUrl());
        assertFalse(m.personalizada());
    }

    @Test
    @DisplayName("La sucursal del enlace lleva a la marca de su restaurante")
    void deSucursal() {
        UUID branchId = UUID.randomUUID();
        when(branchRepository.findById(branchId)).thenReturn(Optional.of(Branch.builder().id(branchId).restaurant(restaurante).build()));
        servicio.guardar(restaurantId, new MarcaService.Cambios("El Farolito", "#c8381f"));

        MarcaService.Marca m = servicio.deSucursal(branchId);
        assertEquals("El Farolito", m.nombre());
        assertEquals("El Farolito", m.nombrePropio());
        assertEquals("#C8381F", m.color());
        assertTrue(m.personalizada());
    }

    @Test
    @DisplayName("Dejar los campos vacíos regresa al nombre y colores de siempre")
    void volverAlDeSiempre() {
        servicio.guardar(restaurantId, new MarcaService.Cambios("El Farolito", "#C8381F"));
        MarcaService.Marca m = servicio.guardar(restaurantId, new MarcaService.Cambios("  ", ""));
        assertEquals("Tacos El Farolito", m.nombre());
        assertNull(m.color());
    }

    @Test
    @DisplayName("Rechaza colores que no son #RRGGBB y nombres demasiado largos")
    void validaciones() {
        assertThrows(IllegalArgumentException.class,
                () -> servicio.guardar(restaurantId, new MarcaService.Cambios(null, "rojo")));
        assertThrows(IllegalArgumentException.class,
                () -> servicio.guardar(restaurantId, new MarcaService.Cambios(null, "#12345")));
        assertThrows(IllegalArgumentException.class,
                () -> servicio.guardar(restaurantId, new MarcaService.Cambios("x".repeat(61), null)));
        assertTrue(guardadas.isEmpty());
    }

    @Test
    @DisplayName("El logo se reduce a 512 px, queda en PNG con transparencia y su URL lleva versión")
    void logo() throws Exception {
        BufferedImage grande = new BufferedImage(1600, 800, BufferedImage.TYPE_INT_ARGB);
        MarcaService.Marca m = servicio.subirLogo(restaurantId,
                new MockMultipartFile("logo", "logo.png", "image/png", png(grande)));

        BufferedImage guardado = ImageIO.read(new ByteArrayInputStream(guardadas.get(restaurantId).getLogo()));
        assertEquals(512, guardado.getWidth());
        assertEquals(256, guardado.getHeight());
        assertTrue(guardado.getColorModel().hasAlpha(), "la transparencia se conserva");
        assertTrue(m.logoUrl().startsWith("/public/restaurantes/" + restaurantId + "/logo?v="));

        assertNull(servicio.quitarLogo(restaurantId).logoUrl());
    }

    @Test
    @DisplayName("Un archivo que no es imagen o un logo diminuto no se guardan")
    void logoInvalido() throws Exception {
        assertThrows(IllegalArgumentException.class, () -> servicio.subirLogo(restaurantId,
                new MockMultipartFile("logo", "x.txt", "text/plain", "hola".getBytes())));
        assertThrows(IllegalArgumentException.class, () -> servicio.subirLogo(restaurantId,
                new MockMultipartFile("logo", "x.png", "image/png", png(new BufferedImage(20, 20, BufferedImage.TYPE_INT_ARGB)))));
        assertTrue(guardadas.isEmpty());
    }

    private static byte[] png(BufferedImage img) throws Exception {
        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        ImageIO.write(img, "png", bytes);
        return bytes.toByteArray();
    }
}
