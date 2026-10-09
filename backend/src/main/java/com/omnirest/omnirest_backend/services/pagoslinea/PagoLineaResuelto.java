package com.omnirest.omnirest_backend.services.pagoslinea;

import java.util.UUID;

/**
 * Stripe resolvio el pago en linea de un pedido: pagado (ya puede verlo el
 * mostrador) o no (no se pago a tiempo o se cancelo: el pedido se cancela).
 */
public record PagoLineaResuelto(UUID orderId, UUID branchId, boolean pagado) {
}
