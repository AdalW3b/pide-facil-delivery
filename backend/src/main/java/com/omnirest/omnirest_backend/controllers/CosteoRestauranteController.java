package com.omnirest.omnirest_backend.controllers;

import com.omnirest.omnirest_backend.dtos.OperacionesInventarioDTOs;
import com.omnirest.omnirest_backend.security.CustomUserDetails;
import com.omnirest.omnirest_backend.services.OperacionesInventarioService;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;

/**
 * El costeo de todas las sucursales juntas y de cada una: solo el dueño. Cada
 * gerente ve el de su sucursal en Inventario › Reporte.
 */
@RestController
@RequestMapping("/api/v1/inventario")
@RequiredArgsConstructor
@PreAuthorize("hasAuthority('SUPER_ADMIN')")
public class CosteoRestauranteController {

    private final OperacionesInventarioService operaciones;

    @GetMapping("/costeo-sucursales")
    public ResponseEntity<OperacionesInventarioDTOs.CosteoRestaurante> sucursales(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate desde,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate hasta,
            @AuthenticationPrincipal CustomUserDetails dueno) {
        if (dueno == null || dueno.restaurantId() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Tu usuario no tiene restaurante.");
        }
        return ResponseEntity.ok(operaciones.reporteDelRestaurante(dueno.restaurantId(), desde, hasta));
    }
}
