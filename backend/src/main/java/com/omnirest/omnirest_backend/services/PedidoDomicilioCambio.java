package com.omnirest.omnirest_backend.services;

import java.util.UUID;

/**
 * Algo cambio en un pedido a domicilio fuera del tablero, por ejemplo cocina
 * termino un platillo. El tablero lo escucha para volver a publicarse: sin
 * esto, el mostrador no veia que ya se podia empacar.
 *
 * Es un evento y no una llamada directa porque DeliveryService ya depende de
 * OrderService, y la dependencia al reves haria un ciclo.
 */
public record PedidoDomicilioCambio(UUID branchId) {
}
