package com.omnirest.omnirest_backend.domain.entities;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

/** Un cobro en linea: un PaymentIntent en la cuenta de Stripe del restaurante. */
@Entity
@jakarta.persistence.Table(name = "transacciones_linea")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TransaccionLinea {

    public enum Estado { PENDIENTE, PROCESANDO, PAGADO, FALLIDO, CANCELADO, REEMBOLSADO, REEMBOLSO_PARCIAL }

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "restaurant_id", nullable = false)
    private UUID restaurantId;

    @Column(name = "branch_id", nullable = false)
    private UUID branchId;

    @Column(name = "order_id", nullable = false)
    private UUID orderId;

    @Column(name = "stripe_account_id", nullable = false, length = 60)
    private String stripeAccountId;

    @Column(name = "payment_intent_id", length = 80, unique = true)
    private String paymentIntentId;

    @Column(name = "clave_idempotencia", nullable = false, length = 80, unique = true)
    private String claveIdempotencia;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private Estado estado = Estado.PENDIENTE;

    @Column(nullable = false, length = 3)
    @Builder.Default
    private String moneda = "mxn";

    /** Lo que se le cobra al cliente, propina incluida. */
    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal monto;

    @Column(nullable = false, precision = 12, scale = 2)
    @Builder.Default
    private BigDecimal propina = BigDecimal.ZERO;

    @Column(name = "monto_reembolsado", nullable = false, precision = 12, scale = 2)
    @Builder.Default
    private BigDecimal montoReembolsado = BigDecimal.ZERO;

    @Column(name = "comision_stripe", precision = 12, scale = 2)
    private BigDecimal comisionStripe;

    @Column(name = "comision_plataforma", nullable = false, precision = 12, scale = 2)
    @Builder.Default
    private BigDecimal comisionPlataforma = BigDecimal.ZERO;

    @Column(name = "marca_tarjeta", length = 20)
    private String marcaTarjeta;

    @Column(length = 4)
    private String ultimos4;

    /** Telefono enmascarado del cliente. */
    @Column(name = "cliente_ref", length = 40)
    private String clienteRef;

    @Column(length = 300)
    private String error;

    @Column(name = "expira_en")
    private LocalDateTime expiraEn;

    @Column(name = "pagado_en")
    private LocalDateTime pagadoEn;

    @Column(name = "creado_en", nullable = false, updatable = false)
    @Builder.Default
    private LocalDateTime creadoEn = LocalDateTime.now();

    @Column(name = "actualizado_en", nullable = false)
    @Builder.Default
    private LocalDateTime actualizadoEn = LocalDateTime.now();
}
