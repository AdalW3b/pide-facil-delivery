package com.omnirest.omnirest_backend.dtos;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Lo que necesita el menu en linea para cobrar con tarjeta: el formulario de
 * Stripe se arma con la llave publica de la plataforma y la cuenta del
 * restaurante, y paga el cobro que dice {@code clientSecret}.
 */
public record PagoEnLineaDTO(
        UUID transaccionId,
        String clientSecret,
        String llavePublica,
        String cuenta,
        BigDecimal monto,
        /** Si no se paga antes, el pedido se cancela solo. */
        LocalDateTime expiraEn) {
}
