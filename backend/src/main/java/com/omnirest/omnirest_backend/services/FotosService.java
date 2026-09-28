package com.omnirest.omnirest_backend.services;

import com.omnirest.omnirest_backend.domain.entities.FotoProducto;
import com.omnirest.omnirest_backend.domain.entities.Product;
import com.omnirest.omnirest_backend.repositories.FotoProductoRepository;
import com.omnirest.omnirest_backend.repositories.ProductRepository;
import com.omnirest.omnirest_backend.security.CustomUserDetails;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import javax.imageio.IIOImage;
import javax.imageio.ImageIO;
import javax.imageio.ImageWriteParam;
import javax.imageio.ImageWriter;
import javax.imageio.stream.ImageOutputStream;
import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * Fotos de los platillos.
 *
 * El servidor no guarda el archivo tal cual llega: lo decodifica y lo vuelve a
 * escribir en los dos tamaños que usa el menu. Asi un archivo que no es imagen
 * no pasa, una foto de 12 megapixeles no llega entera al telefono del cliente,
 * y se pierden los metadatos (incluida la ubicacion GPS de quien la tomo).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class FotosService {

    private static final int ANCHO_GRANDE = 1200;
    private static final int LADO_MINIATURA = 400;
    private static final float CALIDAD_JPEG = 0.82f;
    /** Lo que se acepta de entrada, ya comprimido o no. */
    private static final long MAXIMO_BYTES = 5L * 1024 * 1024;
    /** Una imagen enorme en pixeles gasta mucha memoria al decodificarse. */
    private static final int MAXIMO_LADO_ENTRADA = 6000;

    private final FotoProductoRepository fotoRepository;
    private final ProductRepository productRepository;

    @Transactional
    public LocalDateTime subir(UUID productId, MultipartFile archivo, CustomUserDetails user) {
        Product producto = productoPropio(productId, user);
        if (archivo == null || archivo.isEmpty()) {
            throw new IllegalArgumentException("Elige una foto.");
        }
        if (archivo.getSize() > MAXIMO_BYTES) {
            throw new IllegalArgumentException("La foto pesa más de 5 MB. Elige una más ligera.");
        }

        BufferedImage original;
        try {
            original = ImageIO.read(new ByteArrayInputStream(archivo.getBytes()));
        } catch (IOException e) {
            original = null;
        }
        if (original == null) {
            throw new IllegalArgumentException("No pudimos leer esa foto. Usa una imagen JPG o PNG.");
        }
        if (original.getWidth() > MAXIMO_LADO_ENTRADA || original.getHeight() > MAXIMO_LADO_ENTRADA) {
            throw new IllegalArgumentException("La foto es demasiado grande. Usa una de menos de 6000 px por lado.");
        }
        if (original.getWidth() < 200 || original.getHeight() < 200) {
            throw new IllegalArgumentException("La foto es muy pequeña: se vería borrosa. Usa una de al menos 200 px.");
        }

        LocalDateTime ahora = LocalDateTime.now();
        FotoProducto foto = fotoRepository.findById(productId)
                .orElseGet(() -> FotoProducto.builder().productId(productId).build());
        foto.setGrande(jpeg(reducir(original, ANCHO_GRANDE)));
        foto.setMiniatura(jpeg(recorteCuadrado(original, LADO_MINIATURA)));
        foto.setTipo("image/jpeg");
        foto.setActualizadoEn(ahora);
        fotoRepository.save(foto);

        log.info("Foto de {} guardada ({} KB grande, {} KB miniatura)", producto.getName(),
                foto.getGrande().length / 1024, foto.getMiniatura().length / 1024);
        return ahora;
    }

    @Transactional
    public void quitar(UUID productId, CustomUserDetails user) {
        productoPropio(productId, user);
        fotoRepository.deleteById(productId);
    }

    /** productId -> version de su foto, para el panel. */
    @Transactional(readOnly = true)
    public Map<UUID, LocalDateTime> versiones(UUID restaurantId) {
        Map<UUID, LocalDateTime> mapa = new HashMap<>();
        fotoRepository.versionesDelRestaurante(restaurantId)
                .forEach(v -> mapa.put(v.getProductId(), v.getActualizadoEn()));
        return mapa;
    }

    @Transactional(readOnly = true)
    public Optional<byte[]> leer(UUID productId, boolean miniatura) {
        return miniatura ? fotoRepository.miniatura(productId) : fotoRepository.grande(productId);
    }

    /** La URL publica de la foto; la version evita que el navegador muestre la vieja. */
    public static String url(UUID productId, LocalDateTime version, String tamano) {
        if (version == null) return null;
        return "/public/productos/" + productId + "/foto?tam=" + tamano + "&v="
                + version.toEpochSecond(java.time.ZoneOffset.UTC);
    }

    // ------------------------------------------------------------------

    private Product productoPropio(UUID productId, CustomUserDetails user) {
        Product producto = productRepository.findById(productId)
                .orElseThrow(() -> new IllegalArgumentException("Platillo no encontrado."));
        UUID restaurante = producto.getCategory() != null && producto.getCategory().getRestaurant() != null
                ? producto.getCategory().getRestaurant().getId() : null;
        if (user == null || user.restaurantId() == null || !user.restaurantId().equals(restaurante)) {
            throw new AccessDeniedException("Ese platillo no es de tu restaurante.");
        }
        return producto;
    }

    /** Reduce al ancho indicado conservando la proporcion; nunca agranda. */
    private static BufferedImage reducir(BufferedImage img, int anchoMaximo) {
        if (img.getWidth() <= anchoMaximo) return aRgb(img, img.getWidth(), img.getHeight(), 0, 0, img.getWidth(), img.getHeight());
        int alto = Math.round(img.getHeight() * (anchoMaximo / (float) img.getWidth()));
        return aRgb(img, anchoMaximo, alto, 0, 0, img.getWidth(), img.getHeight());
    }

    /** Cuadrado centrado: en la lista todas las miniaturas miden lo mismo. */
    private static BufferedImage recorteCuadrado(BufferedImage img, int lado) {
        int corto = Math.min(img.getWidth(), img.getHeight());
        int x = (img.getWidth() - corto) / 2;
        int y = (img.getHeight() - corto) / 2;
        int destino = Math.min(lado, corto);
        return aRgb(img, destino, destino, x, y, x + corto, y + corto);
    }

    /**
     * Dibuja sobre fondo blanco en RGB: un PNG con transparencia pasado a JPEG
     * sin fondo sale negro.
     */
    private static BufferedImage aRgb(BufferedImage img, int ancho, int alto, int sx1, int sy1, int sx2, int sy2) {
        BufferedImage salida = new BufferedImage(ancho, alto, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = salida.createGraphics();
        g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BICUBIC);
        g.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
        g.setColor(Color.WHITE);
        g.fillRect(0, 0, ancho, alto);
        g.drawImage(img, 0, 0, ancho, alto, sx1, sy1, sx2, sy2, null);
        g.dispose();
        return salida;
    }

    private static byte[] jpeg(BufferedImage img) {
        try (ByteArrayOutputStream bytes = new ByteArrayOutputStream();
             ImageOutputStream salida = ImageIO.createImageOutputStream(bytes)) {
            ImageWriter escritor = ImageIO.getImageWritersByFormatName("jpeg").next();
            ImageWriteParam param = escritor.getDefaultWriteParam();
            param.setCompressionMode(ImageWriteParam.MODE_EXPLICIT);
            param.setCompressionQuality(CALIDAD_JPEG);
            escritor.setOutput(salida);
            escritor.write(null, new IIOImage(img, null, null), param);
            escritor.dispose();
            salida.flush();
            return bytes.toByteArray();
        } catch (IOException e) {
            throw new IllegalStateException("No se pudo procesar la foto.", e);
        }
    }
}
