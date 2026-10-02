package com.omnirest.omnirest_backend.domain.entities;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

/** Lo propio de Rappi de un pedido: su numero, como se entrega y lo que paga. */
@Entity
@jakarta.persistence.Table(name = "pedidos_rappi")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PedidoRappi {

    @Id
    @Column(name = "order_id")
    private UUID orderId;

    @Column(name = "rappi_order_id", nullable = false, unique = true, length = 40)
    private String rappiOrderId;

    @Column(name = "store_id", nullable = false, length = 40)
    private String storeId;

    /** delivery (repartidor de Rappi), marketplace (repartidor propio) o pickup. */
    @Column(name = "metodo_entrega", length = 20)
    private String metodoEntrega;

    @Column(name = "metodo_pago", length = 30)
    private String metodoPago;

    /** Lo que Rappi le paga al restaurante por este pedido. */
    @Column(name = "total_rappi", precision = 12, scale = 2)
    private BigDecimal totalRappi;

    /** Efectivo que el cliente paga en mostrador o al repartidor propio. */
    @Column(name = "efectivo_a_cobrar", precision = 12, scale = 2)
    private BigDecimal efectivoACobrar;

    @Column(name = "minutos_cocina")
    private Integer minutosCocina;

    @Column(name = "minutos_cocina_min")
    private Integer minutosCocinaMin;

    @Column(name = "minutos_cocina_max")
    private Integer minutosCocinaMax;

    /** Platillos que no se pudieron ligar al menu, uno por renglon. */
    @Column(name = "sin_ligar", columnDefinition = "text")
    private String sinLigar;

    @Column(name = "ultimo_evento", length = 60)
    private String ultimoEvento;

    @Column(name = "ultimo_evento_en")
    private LocalDateTime ultimoEventoEn;

    /** El repartidor de Rappi, cuando Rappi lo asigna. */
    @Column(length = 120)
    private String repartidor;

    @Column(name = "recibido_en", insertable = false, updatable = false)
    private LocalDateTime recibidoEn;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false, columnDefinition = "jsonb")
    private String payload;
}
