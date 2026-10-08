package com.omnirest.omnirest_backend.controllers;

import com.omnirest.omnirest_backend.security.CustomUserDetails;
import com.omnirest.omnirest_backend.services.MarcaService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.time.Duration;
import java.util.UUID;

/**
 * La marca del restaurante (nombre, color y logo). La ve todo su equipo en el
 * panel y sus clientes en las pantallas publicas; solo el dueño la cambia.
 */
@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
public class MarcaController {

    private final MarcaService marcaService;

    /** La del restaurante de quien entra. El operador no tiene restaurante: ve Pide Facil. */
    @GetMapping("/marca")
    public ResponseEntity<MarcaService.Marca> mia(@AuthenticationPrincipal CustomUserDetails user) {
        if (user == null || user.restaurantId() == null) {
            return ResponseEntity.noContent().build();
        }
        return ResponseEntity.ok(marcaService.deRestaurante(user.restaurantId()));
    }

    @PutMapping("/marca")
    @PreAuthorize("hasAuthority('SUPER_ADMIN')")
    public ResponseEntity<MarcaService.Marca> guardar(@RequestBody MarcaService.Cambios cambios,
                                                      @AuthenticationPrincipal CustomUserDetails dueno) {
        return ResponseEntity.ok(marcaService.guardar(restaurante(dueno), cambios));
    }

    @PostMapping(value = "/marca/logo", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasAuthority('SUPER_ADMIN')")
    public ResponseEntity<MarcaService.Marca> subirLogo(@RequestParam("logo") MultipartFile logo,
                                                        @AuthenticationPrincipal CustomUserDetails dueno) {
        return ResponseEntity.ok(marcaService.subirLogo(restaurante(dueno), logo));
    }

    @DeleteMapping("/marca/logo")
    @PreAuthorize("hasAuthority('SUPER_ADMIN')")
    public ResponseEntity<MarcaService.Marca> quitarLogo(@AuthenticationPrincipal CustomUserDetails dueno) {
        return ResponseEntity.ok(marcaService.quitarLogo(restaurante(dueno)));
    }

    /** Para el menu, el kiosko, la cuenta del cliente y la pantalla del repartidor. */
    @GetMapping("/public/branches/{branchId}/marca")
    public ResponseEntity<MarcaService.Marca> deSucursal(@PathVariable UUID branchId) {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.maxAge(Duration.ofMinutes(5)).cachePublic())
                .body(marcaService.deSucursal(branchId));
    }

    /** El logo, publico. La URL lleva la version, asi que se guarda en cache mucho tiempo. */
    @GetMapping("/public/restaurantes/{restaurantId}/logo")
    public ResponseEntity<byte[]> logo(@PathVariable UUID restaurantId) {
        return marcaService.logo(restaurantId)
                .map(bytes -> ResponseEntity.ok()
                        .contentType(MediaType.IMAGE_PNG)
                        .cacheControl(CacheControl.maxAge(Duration.ofDays(30)).cachePublic().immutable())
                        .body(bytes))
                .orElse(ResponseEntity.notFound().build());
    }

    private static UUID restaurante(CustomUserDetails dueno) {
        if (dueno == null || dueno.restaurantId() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Tu usuario no tiene restaurante.");
        }
        return dueno.restaurantId();
    }
}
