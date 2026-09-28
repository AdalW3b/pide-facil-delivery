package com.omnirest.omnirest_backend.dtos;

import com.omnirest.omnirest_backend.domain.enums.TipoCuenta;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record IniciarSesionCuentaDTO(
        @NotNull TipoCuenta tipo,
        @NotBlank @Size(max = 20) String phoneNumber,
        @NotBlank String password) {
}
