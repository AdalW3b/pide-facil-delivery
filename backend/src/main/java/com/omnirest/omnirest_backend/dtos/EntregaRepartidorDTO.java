package com.omnirest.omnirest_backend.dtos;

import com.omnirest.omnirest_backend.domain.enums.DeliveryStatus;

import java.math.BigDecimal;
import java.util.List;

/**
 * Lo que ve el repartidor al abrir el enlace del grupo. Solo lleva lo que
 * necesita para entregar: no expone datos del negocio ni de otros pedidos.
 */
public record EntregaRepartidorDTO(
        /** La sucursal del pedido: con ella la pantalla pide el codigo y guarda la sesion. */
        java.util.UUID branchId,
        String token,
        DeliveryStatus estado,
        /** True si nadie la ha tomado y sigue disponible. */
        boolean disponible,
        /** True si quien consulta es el repartidor que la tiene asignada. */
        boolean esMia,
        /** Nombre de quien la tomo, para que los demas sepan que ya tiene dueno. */
        String tomadaPor,
        /** True cuando el pedido ya esta empacado y se puede recoger. */
        boolean listoParaRecoger,

        String sucursal,
        String direccionSucursal,

        String clienteNombre,
        String clienteTelefono,
        String direccion,
        String referencias,
        String notas,
        BigDecimal latitud,
        BigDecimal longitud,
        BigDecimal distanciaKm,

        List<String> platillos,
        /** Lo que el repartidor debe cobrar al entregar. */
        BigDecimal aCobrar,
        BigDecimal pagaCon,
        BigDecimal cambio,
        /** Lo que el negocio le paga por esta entrega. */
        BigDecimal tuPago) {
}
