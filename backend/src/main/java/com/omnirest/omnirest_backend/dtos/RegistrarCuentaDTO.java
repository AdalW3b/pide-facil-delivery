package com.omnirest.omnirest_backend.dtos;

import com.omnirest.omnirest_backend.domain.enums.TipoCuenta;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * Alta de cuenta, y tambien cambio de contrasena olvidada: los dos piden el
 * codigo que llego por WhatsApp.
 *
 * Los mensajes van escritos porque los lee el cliente final en su pantalla, no
 * un programador en una traza.
 */
public record RegistrarCuentaDTO(
        @NotNull(message = "Falta decir si la cuenta es de cliente o de repartidor.")
        TipoCuenta tipo,

        @NotBlank(message = "Escribe tu número de WhatsApp.")
        @Size(max = 20, message = "Ese número es demasiado largo.")
        String phoneNumber,

        /** El codigo de seis digitos que llego por WhatsApp. */
        @NotBlank(message = "Escribe el código que te llegó por WhatsApp.")
        @Size(min = 4, max = 10, message = "El código no tiene el formato correcto.")
        String codigo,

        @NotBlank(message = "Escribe una contraseña.")
        @Size(min = 8, max = 72, message = "La contraseña debe tener al menos 8 caracteres.")
        String password,

        @Size(max = 120, message = "Ese nombre es demasiado largo.")
        String nombre,

        @Email(message = "Ese correo no parece válido.")
        @Size(max = 160, message = "Ese correo es demasiado largo.")
        String email) {
}
