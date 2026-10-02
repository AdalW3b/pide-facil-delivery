package com.omnirest.omnirest_backend.domain.entities;

import com.omnirest.omnirest_backend.domain.enums.DeliveryStatus;
import com.omnirest.omnirest_backend.domain.enums.OrderStatus;
import com.omnirest.omnirest_backend.domain.enums.OrderType;
import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Entity
@jakarta.persistence.Table(name = "orders")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Order {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "branch_id", nullable = false)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private Branch branch;

    /**
     * Solo los pedidos de salon tienen mesa. En domicilio y para llevar viene en
     * null, y la base lo cuida con la restriccion orders_salon_con_mesa.
     */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "table_id")
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private Table table;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "customer_id")
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private Customer customer;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    private OrderStatus status = OrderStatus.OPEN;

    @Column(name = "total_amount", precision = 10, scale = 2)
    @Builder.Default
    private BigDecimal totalAmount = BigDecimal.ZERO;

    @Column(name = "created_at", insertable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "closed_at")
    private LocalDateTime closedAt;

    @OneToMany(mappedBy = "order", fetch = FetchType.LAZY, cascade = CascadeType.ALL, orphanRemoval = true)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private List<OrderItem> orderItems;

    @Column(name = "waiter_name")
    private String waiterName;

    /**
     * Etapa de cocina mas avanzada que ya se le aviso al comensal por WhatsApp.
     * Evita repetirle "tu pedido esta en preparacion" cada vez que se agrega un
     * platillo nuevo y el pedido vuelve a pasar por esa etapa.
     */
    @Column(name = "kitchen_notified", length = 20)
    private String kitchenNotified;

    // ------------------------------------------------------------------
    // Entrega a domicilio
    // ------------------------------------------------------------------

    @Enumerated(EnumType.STRING)
    @Column(name = "order_type", length = 20, nullable = false)
    @Builder.Default
    private OrderType orderType = OrderType.SALON;

    @Enumerated(EnumType.STRING)
    @Column(name = "delivery_status", length = 20)
    private DeliveryStatus deliveryStatus;

    /**
     * Direccion y pin copiados al momento de pedir. Si el cliente luego corrige
     * su direccion guardada, este pedido conserva a donde se llevo realmente.
     */
    @Column(name = "direccion_entrega", length = 300)
    private String direccionEntrega;

    @Column(name = "referencias_entrega", length = 300)
    private String referenciasEntrega;

    @Column(name = "latitud_entrega", precision = 10, scale = 7)
    private BigDecimal latitudEntrega;

    @Column(name = "longitud_entrega", precision = 10, scale = 7)
    private BigDecimal longitudEntrega;

    @Column(name = "notas_entrega", length = 300)
    private String notasEntrega;

    @Column(name = "distancia_km", precision = 6, scale = 2)
    private BigDecimal distanciaKm;

    /**
     * Importes del envio congelados al confirmar: si la sucursal cambia su
     * tarifa manana, este pedido no se recalcula.
     */
    @Column(name = "envio_total", precision = 10, scale = 2)
    private BigDecimal envioTotal;

    @Column(name = "envio_absorbido", precision = 10, scale = 2)
    private BigDecimal envioAbsorbido;

    @Column(name = "envio_cobrado", precision = 10, scale = 2)
    private BigDecimal envioCobrado;

    /** Con cuanto va a pagar el cliente, para que el repartidor lleve cambio. */
    @Column(name = "paga_con", precision = 10, scale = 2)
    private BigDecimal pagaCon;

    @Column(precision = 10, scale = 2)
    private BigDecimal propina;

    @Column(name = "minutos_estimados")
    private Integer minutosEstimados;

    /** Clave publica del pedido: lo que el cliente usa para seguir su entrega. */
    /** Cuando se le mando la cuenta al cliente por WhatsApp desde el panel. */
    @Column(name = "cuenta_enviada_en")
    private java.time.LocalDateTime cuentaEnviadaEn;

    /** El cuadre de caja que liquido esta entrega; null mientras no se liquide. */
    @Column(name = "corte_id")
    private UUID corteId;

    /** Por donde entro: WEB, TELEFONO, WHATSAPP, SALON o RAPPI. Null en pedidos viejos. */
    @Column(length = 15)
    private String origen;

    /**
     * El cliente de un pedido que llega de otra plataforma. No es nuestro
     * cliente: no se guarda en customers ni se le escribe por WhatsApp.
     */
    @Column(name = "cliente_externo", length = 120)
    private String clienteExterno;

    /** El numero del pedido en la plataforma, el que se dicta al repartidor. */
    @Column(name = "pedido_externo", length = 40)
    private String pedidoExterno;

    /**
     * El inventario se descuenta al aceptar el pedido y no al recibirlo. Vuelve
     * a false en cuanto se descuenta.
     */
    @Column(name = "descontar_al_aceptar", nullable = false)
    @Builder.Default
    private Boolean descontarAlAceptar = false;

    /** Lo lleva el repartidor de la plataforma, no uno de la sucursal. */
    @Column(name = "reparto_externo", nullable = false)
    @Builder.Default
    private Boolean repartoExterno = false;

    @Column(name = "token_seguimiento", length = 40)
    private String tokenSeguimiento;

    @Column(name = "recogido_en")
    private LocalDateTime recogidoEn;

    @Column(name = "entregado_en")
    private LocalDateTime entregadoEn;

    /** Quien lleva el pedido. Null mientras nadie lo ha tomado del grupo. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "driver_id")
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private Driver driver;

    @Column(name = "asignado_en")
    private LocalDateTime asignadoEn;

    /** Lo que se le paga al repartidor, congelado al tomar la entrega. */
    @Column(name = "pago_repartidor", precision = 10, scale = 2)
    private BigDecimal pagoRepartidor;

    public boolean esDomicilio() {
        return orderType == OrderType.DOMICILIO;
    }
}
