package com.omnirest.omnirest_backend.controllers;

import com.omnirest.omnirest_backend.dtos.GastosDTOs;
import com.omnirest.omnirest_backend.services.GastosService;
import com.omnirest.omnirest_backend.services.SecurityValidationService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

/** Gastos de la sucursal (renta, luz, nomina…) y los que se repiten cada mes. Los lleva el dueño o el gerente. */
@RestController
@RequestMapping("/api/v1/branches/{branchId}/gastos")
@RequiredArgsConstructor
@PreAuthorize("hasAnyAuthority('SUPER_ADMIN', 'SYSTEM_ADMIN', 'ADMIN', 'BRANCH_MANAGER')")
public class GastosController {

    private final GastosService gastos;
    private final SecurityValidationService seguridad;

    /** Lo de un mes ("2026-10"; sin mes, el actual). */
    @GetMapping
    public ResponseEntity<GastosDTOs.Mes> mes(@PathVariable UUID branchId, @RequestParam(required = false) String mes) {
        seguridad.validateUserAccessToBranch(branchId);
        return ResponseEntity.ok(gastos.mes(branchId, mes));
    }

    @PostMapping
    public ResponseEntity<GastosDTOs.Resultado> registrar(@PathVariable UUID branchId, @Valid @RequestBody GastosDTOs.NuevoGasto datos) {
        seguridad.validateUserAccessToBranch(branchId);
        return ResponseEntity.ok(gastos.registrar(branchId, datos));
    }

    @PostMapping("/{id}/anular")
    public ResponseEntity<GastosDTOs.Resultado> anular(@PathVariable UUID branchId, @PathVariable UUID id) {
        seguridad.validateUserAccessToBranch(branchId);
        return ResponseEntity.ok(gastos.anular(branchId, id));
    }

    @PostMapping("/fijos")
    public ResponseEntity<GastosDTOs.Resultado> crearFijo(@PathVariable UUID branchId, @Valid @RequestBody GastosDTOs.GuardarGastoFijo datos) {
        seguridad.validateUserAccessToBranch(branchId);
        return ResponseEntity.ok(gastos.guardarFijo(branchId, null, datos));
    }

    @PutMapping("/fijos/{id}")
    public ResponseEntity<GastosDTOs.Resultado> editarFijo(@PathVariable UUID branchId, @PathVariable UUID id,
                                                           @Valid @RequestBody GastosDTOs.GuardarGastoFijo datos) {
        seguridad.validateUserAccessToBranch(branchId);
        return ResponseEntity.ok(gastos.guardarFijo(branchId, id, datos));
    }

    @DeleteMapping("/fijos/{id}")
    public ResponseEntity<GastosDTOs.Resultado> quitarFijo(@PathVariable UUID branchId, @PathVariable UUID id) {
        seguridad.validateUserAccessToBranch(branchId);
        return ResponseEntity.ok(gastos.quitarFijo(branchId, id));
    }
}
