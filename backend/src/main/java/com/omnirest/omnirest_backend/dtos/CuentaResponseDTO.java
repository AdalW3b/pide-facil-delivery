package com.omnirest.omnirest_backend.dtos;

import com.omnirest.omnirest_backend.domain.enums.TipoCuenta;

import java.util.UUID;

/** La sesion recien abierta, con lo minimo para saludar y guardar el token. */
public record CuentaResponseDTO(
        String token,
        TipoCuenta tipo,
        UUID id,
        String nombre,
        String telefono,
        String email) {
}
