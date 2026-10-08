package com.omnirest.omnirest_backend.services;

import com.omnirest.omnirest_backend.domain.entities.Branch;
import com.omnirest.omnirest_backend.domain.entities.MarcaRestaurante;
import com.omnirest.omnirest_backend.domain.entities.Restaurant;
import com.omnirest.omnirest_backend.repositories.BranchRepository;
import com.omnirest.omnirest_backend.repositories.MarcaRestauranteRepository;
import com.omnirest.omnirest_backend.repositories.RestaurantRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import javax.imageio.ImageIO;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.Optional;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * La marca del restaurante: con que nombre, color y logo lo ven sus clientes
 * y su equipo. Solo cambia la apariencia; ninguna regla del sistema depende
 * de esto. Sin marca guardada se ve como Pide Facil.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class MarcaService {

    /**
     * Lo que ve la pantalla. {@code nombre} es el que se muestra; {@code nombrePropio}
     * el que eligio el dueño (null = el del restaurante). Color y logo null = los de Pide Facil.
     */
    public record Marca(String nombre, String nombrePropio, String color, String logoUrl, boolean personalizada) {
    }

    /** Lo que el dueño cambia; vacio = volver al de siempre. */
    public record Cambios(String nombre, String color) {
    }

    static final int NOMBRE_MAXIMO = 60;
    private static final Pattern COLOR = Pattern.compile("^#[0-9a-fA-F]{6}$");
    private static final long LOGO_MAXIMO_BYTES = 2L * 1024 * 1024;
    private static final int LOGO_LADO = 512;
    private static final int LOGO_LADO_MINIMO = 64;
    private static final int LOGO_LADO_ENTRADA_MAXIMO = 6000;

    private final MarcaRestauranteRepository marcaRepository;
    private final RestaurantRepository restaurantRepository;
    private final BranchRepository branchRepository;

    @Transactional(readOnly = true)
    public Marca deRestaurante(UUID restaurantId) {
        Restaurant restaurante = restaurantRepository.findById(restaurantId)
                .orElseThrow(() -> new IllegalArgumentException("Restaurante no encontrado."));
        return armar(restaurante, marcaRepository.datos(restaurantId));
    }

    /** Para las pantallas publicas, que solo conocen la sucursal del enlace. */
    @Transactional(readOnly = true)
    public Marca deSucursal(UUID branchId) {
        Branch sucursal = branchRepository.findById(branchId)
                .orElseThrow(() -> new IllegalArgumentException("Sucursal no encontrada."));
        Restaurant restaurante = sucursal.getRestaurant();
        return armar(restaurante, marcaRepository.datos(restaurante.getId()));
    }

    @Transactional
    public Marca guardar(UUID restaurantId, Cambios cambios) {
        String nombre = limpio(cambios != null ? cambios.nombre() : null);
        if (nombre != null && nombre.length() > NOMBRE_MAXIMO) {
            throw new IllegalArgumentException("El nombre puede tener hasta " + NOMBRE_MAXIMO + " letras.");
        }
        String color = limpio(cambios != null ? cambios.color() : null);
        if (color != null && !COLOR.matcher(color).matches()) {
            throw new IllegalArgumentException("El color va como #RRGGBB, por ejemplo #C8381F.");
        }
        MarcaRestaurante marca = existente(restaurantId);
        marca.setNombre(nombre);
        marca.setColor(color != null ? color.toUpperCase() : null);
        marca.setActualizadoEn(LocalDateTime.now());
        marcaRepository.save(marca);
        log.info("Marca del restaurante {} actualizada: nombre={}, color={}", restaurantId, nombre, marca.getColor());
        return deRestaurante(restaurantId);
    }

    @Transactional
    public Marca subirLogo(UUID restaurantId, MultipartFile archivo) {
        if (archivo == null || archivo.isEmpty()) {
            throw new IllegalArgumentException("Elige una imagen para el logo.");
        }
        if (archivo.getSize() > LOGO_MAXIMO_BYTES) {
            throw new IllegalArgumentException("El logo pesa más de 2 MB. Usa uno más ligero.");
        }
        MarcaRestaurante marca = existente(restaurantId);
        marca.setLogo(procesarLogo(leer(archivo)));
        LocalDateTime ahora = LocalDateTime.now();
        marca.setLogoVersion(ahora);
        marca.setActualizadoEn(ahora);
        marcaRepository.save(marca);
        log.info("Logo del restaurante {} guardado ({} KB)", restaurantId, marca.getLogo().length / 1024);
        return deRestaurante(restaurantId);
    }

    @Transactional
    public Marca quitarLogo(UUID restaurantId) {
        marcaRepository.findById(restaurantId).ifPresent(marca -> {
            marca.setLogo(null);
            marca.setLogoVersion(null);
            marca.setActualizadoEn(LocalDateTime.now());
            marcaRepository.save(marca);
        });
        return deRestaurante(restaurantId);
    }

    @Transactional(readOnly = true)
    public Optional<byte[]> logo(UUID restaurantId) {
        return marcaRepository.logo(restaurantId);
    }

    /** La URL publica del logo; la version evita que el navegador muestre el anterior. */
    static String urlLogo(UUID restaurantId, LocalDateTime version) {
        if (version == null) return null;
        return "/public/restaurantes/" + restaurantId + "/logo?v=" + version.toEpochSecond(ZoneOffset.UTC);
    }

    // ------------------------------------------------------------------

    private Marca armar(Restaurant restaurante, Optional<MarcaRestauranteRepository.Datos> datos) {
        String nombre = datos.map(MarcaRestauranteRepository.Datos::getNombre).orElse(null);
        String color = datos.map(MarcaRestauranteRepository.Datos::getColor).orElse(null);
        LocalDateTime version = datos.map(MarcaRestauranteRepository.Datos::getLogoVersion).orElse(null);
        return new Marca(
                nombre != null ? nombre : restaurante.getName(),
                nombre,
                color,
                urlLogo(restaurante.getId(), version),
                nombre != null || color != null || version != null);
    }

    private MarcaRestaurante existente(UUID restaurantId) {
        if (!restaurantRepository.existsById(restaurantId)) {
            throw new IllegalArgumentException("Restaurante no encontrado.");
        }
        return marcaRepository.findById(restaurantId)
                .orElseGet(() -> MarcaRestaurante.builder().restaurantId(restaurantId).build());
    }

    private static String limpio(String texto) {
        return texto == null || texto.isBlank() ? null : texto.trim();
    }

    private static BufferedImage leer(MultipartFile archivo) {
        BufferedImage imagen;
        try {
            imagen = ImageIO.read(new ByteArrayInputStream(archivo.getBytes()));
        } catch (IOException e) {
            imagen = null;
        }
        if (imagen == null) {
            throw new IllegalArgumentException("No pudimos leer esa imagen. Usa un logo en PNG o JPG.");
        }
        return imagen;
    }

    /** Reduce el logo a 512 px por lado como mucho y lo guarda en PNG, sin perder la transparencia. */
    static byte[] procesarLogo(BufferedImage original) {
        int ancho = original.getWidth();
        int alto = original.getHeight();
        if (ancho > LOGO_LADO_ENTRADA_MAXIMO || alto > LOGO_LADO_ENTRADA_MAXIMO) {
            throw new IllegalArgumentException("El logo es demasiado grande. Usa uno de menos de 6000 px por lado.");
        }
        if (Math.max(ancho, alto) < LOGO_LADO_MINIMO) {
            throw new IllegalArgumentException("El logo es muy pequeño: se vería borroso. Usa uno de al menos 64 px.");
        }
        double escala = Math.min(1.0, LOGO_LADO / (double) Math.max(ancho, alto));
        int nuevoAncho = Math.max(1, (int) Math.round(ancho * escala));
        int nuevoAlto = Math.max(1, (int) Math.round(alto * escala));

        BufferedImage salida = new BufferedImage(nuevoAncho, nuevoAlto, BufferedImage.TYPE_INT_ARGB);
        Graphics2D g = salida.createGraphics();
        g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BICUBIC);
        g.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
        g.drawImage(original, 0, 0, nuevoAncho, nuevoAlto, null);
        g.dispose();

        try (ByteArrayOutputStream bytes = new ByteArrayOutputStream()) {
            ImageIO.write(salida, "png", bytes);
            return bytes.toByteArray();
        } catch (IOException e) {
            throw new IllegalStateException("No se pudo procesar el logo.", e);
        }
    }
}
