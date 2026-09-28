package com.omnirest.omnirest_backend.controllers;

import com.omnirest.omnirest_backend.security.CustomUserDetails;
import com.omnirest.omnirest_backend.services.FotosService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.time.Duration;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

/** Fotos de los platillos: el panel las sube, el menu en linea las muestra. */
@RestController
@RequiredArgsConstructor
public class FotosController {

    private final FotosService fotosService;

    @PostMapping(value = "/api/v1/products/{id}/foto", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasAuthority('CATALOG_UPDATE')")
    public ResponseEntity<Map<String, String>> subir(
            @PathVariable UUID id,
            @RequestParam("foto") MultipartFile foto,
            @AuthenticationPrincipal CustomUserDetails user) {
        var version = fotosService.subir(id, foto, user);
        return ResponseEntity.ok(Map.of("miniatura", FotosService.url(id, version, "mini")));
    }

    @DeleteMapping("/api/v1/products/{id}/foto")
    @PreAuthorize("hasAuthority('CATALOG_UPDATE')")
    public ResponseEntity<Void> quitar(@PathVariable UUID id, @AuthenticationPrincipal CustomUserDetails user) {
        fotosService.quitar(id, user);
        return ResponseEntity.noContent().build();
    }

    /** productId -> URL de su miniatura, para pintar el catalogo del panel. */
    @GetMapping("/api/v1/products/fotos")
    @PreAuthorize("hasAuthority('CATALOG_READ')")
    public ResponseEntity<Map<UUID, String>> fotosDelRestaurante(@AuthenticationPrincipal CustomUserDetails user) {
        Map<UUID, String> urls = new HashMap<>();
        if (user != null && user.restaurantId() != null) {
            fotosService.versiones(user.restaurantId())
                    .forEach((id, version) -> urls.put(id, FotosService.url(id, version, "mini")));
        }
        return ResponseEntity.ok(urls);
    }

    /**
     * La imagen, publica: la ve el cliente en el menu sin cuenta. La URL lleva
     * la version, asi que se puede guardar en cache mucho tiempo; al cambiar
     * la foto cambia la URL.
     */
    @GetMapping("/api/v1/public/productos/{id}/foto")
    public ResponseEntity<byte[]> ver(@PathVariable UUID id, @RequestParam(defaultValue = "grande") String tam) {
        return fotosService.leer(id, "mini".equals(tam))
                .map(bytes -> ResponseEntity.ok()
                        .contentType(MediaType.IMAGE_JPEG)
                        .cacheControl(CacheControl.maxAge(Duration.ofDays(30)).cachePublic().immutable())
                        .body(bytes))
                .orElse(ResponseEntity.notFound().build());
    }
}
