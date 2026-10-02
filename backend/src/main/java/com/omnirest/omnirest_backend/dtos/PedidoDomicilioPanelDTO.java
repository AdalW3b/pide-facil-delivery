package com.omnirest.omnirest_backend.dtos;

import com.omnirest.omnirest_backend.domain.enums.DeliveryStatus;
import com.omnirest.omnirest_backend.domain.enums.KitchenStatus;
import com.omnirest.omnirest_backend.domain.enums.OrderType;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/**
 * Una tarjeta del tablero de reparto. Trae todo lo que el mostrador necesita
 * para decidir sin abrir otra pantalla: quien pide, a donde va, cuanto cobrar y
 * como va la cocina.
 */
public record PedidoDomicilioPanelDTO(
        UUID orderId,
        String tokenSeguimiento,
        OrderType orderType,
        DeliveryStatus deliveryStatus,
        /** El estado menos avanzado de la cocina: si algo falta, aqui se ve. */
        KitchenStatus kitchenStatus,
        LocalDateTime creadoEn,
        Integer minutosEstimados,

        String clienteNombre,
        String clienteTelefono,

        String direccion,
        String referencias,
        String notas,
        BigDecimal latitud,
        BigDecimal longitud,
        BigDecimal distanciaKm,

        BigDecimal subtotal,
        BigDecimal envioTotal,
        BigDecimal envioAbsorbido,
        BigDecimal envioCobrado,
        BigDecimal propina,
        BigDecimal total,
        BigDecimal pagaCon,
        /** Cuanto cambio llevarle. Null si no dijo con cuanto paga. */
        BigDecimal cambio,

        List<KitchenTicketItemDTO> items,

        /** Quien lleva el pedido. Null mientras nadie lo toma del grupo. */
        String repartidorNombre,
        String repartidorTelefono,
        /** Lo que se le paga por esta entrega. */
        BigDecimal pagoRepartidor,

        LocalDateTime recogidoEn,
        LocalDateTime entregadoEn,
        /** Por donde entro: WEB, TELEFONO, WHATSAPP, RAPPI. Null en pedidos viejos. */
        String origen,
        /** El numero del pedido en la plataforma (Rappi). Null en los propios. */
        String pedidoExterno,
        /** Lo lleva el repartidor de la plataforma: no se ofrece al grupo. */
        boolean repartoExterno,
        /** Turno de mostrador (A-023). Null en domicilio. */
        String turno,
        /** AQUI o LLEVAR en pedidos de mostrador. */
        String consumo,
        /** Lo que falta cobrar en caja (pedidos de mostrador); cero si ya se pago o no aplica. */
        BigDecimal porCobrar) {
}
