package com.omnirest.omnirest_backend.controllers;

import com.omnirest.omnirest_backend.repositories.RestaurantRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/restaurants/{restaurantId}") // <-- Subimos un nivel la raíz
@RequiredArgsConstructor
public class RestaurantMenuController {

    private final RestaurantRepository restaurantRepository;

    @PostMapping("/menu")
    @PreAuthorize("hasAnyAuthority('SUPER_ADMIN', 'SYSTEM_ADMIN')")
    public ResponseEntity<?> uploadMenu(@PathVariable UUID restaurantId, @RequestParam("file") MultipartFile file) {
        try {
            restaurantRepository.updateMenuPdf(restaurantId, file.getBytes());
            return ResponseEntity.ok(Map.of("message", "Menú actualizado correctamente"));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Error al procesar el archivo PDF"));
        }
    }

    @GetMapping("/menu/status")
    @PreAuthorize("hasAnyAuthority('SUPER_ADMIN', 'SYSTEM_ADMIN', 'BRANCH_MANAGER')")
    public ResponseEntity<Map<String, Boolean>> checkMenuStatus(@PathVariable UUID restaurantId) {
        return ResponseEntity.ok(Map.of("hasMenu", restaurantRepository.hasMenuPdf(restaurantId)));
    }

    // Ruta explícita y exacta para el archivo
    @GetMapping(value = "/menu.pdf", produces = MediaType.APPLICATION_PDF_VALUE)
    public ResponseEntity<byte[]> getMenuPdf(@PathVariable UUID restaurantId) {
        byte[] pdfData = restaurantRepository.getMenuPdf(restaurantId);
        if (pdfData == null) {
            return ResponseEntity.notFound().build();
        }

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_PDF);
        headers.setContentDispositionFormData("inline", "menu-" + restaurantId.toString().substring(0, 8) + ".pdf");

        return new ResponseEntity<>(pdfData, headers, HttpStatus.OK);
    }

    @DeleteMapping("/menu")
    @PreAuthorize("hasAnyAuthority('SUPER_ADMIN', 'SYSTEM_ADMIN')")
    public ResponseEntity<?> deleteMenu(@PathVariable UUID restaurantId) {
        restaurantRepository.updateMenuPdf(restaurantId, null);
        return ResponseEntity.ok(Map.of("message", "Menú eliminado correctamente"));
    }
}