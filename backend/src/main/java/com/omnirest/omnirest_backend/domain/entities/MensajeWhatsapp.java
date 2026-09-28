package com.omnirest.omnirest_backend.domain.entities;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

/** Un mensaje de WhatsApp en cola: se reintenta hasta enviarse o vencer. */
@Entity
@jakarta.persistence.Table(name = "mensajes_whatsapp")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MensajeWhatsapp {

    public enum Estado { PENDIENTE, ENVIANDO, ENVIADO, VENCIDO, REEMPLAZADO }

    public enum Motivo {
        /** Codigo para abrir cuenta: pasados sus minutos de vida no sirve. */
        CODIGO(10),
        /** "Tu pedido va en camino", "fue entregado". */
        ESTADO_PEDIDO(45),
        /** Pedido listo publicado en el grupo de repartidores. */
        GRUPO_REPARTIDORES(30),
        /** Aviso directo al repartidor que tomo la entrega. */
        AVISO_REPARTIDOR(30),
        /** Alerta a los meseros de la mesa. */
        ALERTA_MESERO(10),
        /** Cancelacion de un pedido o de un platillo. */
        CANCELACION(60),
        /** La cuenta que el mesero le manda al cliente desde el panel. */
        CUENTA(60);

        /** Cuanto sigue valiendo la pena mandarlo. */
        public final int minutosDeVida;

        Motivo(int minutosDeVida) {
            this.minutosDeVida = minutosDeVida;
        }
    }

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "branch_id", nullable = false)
    private UUID branchId;

    @Column(nullable = false, length = 80)
    private String destino;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String texto;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private Motivo motivo;

    @Column(name = "clave_reemplazo", length = 120)
    private String claveReemplazo;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 15)
    @Builder.Default
    private Estado estado = Estado.PENDIENTE;

    @Builder.Default
    private Integer intentos = 0;

    @Column(name = "proximo_intento", nullable = false)
    private LocalDateTime proximoIntento;

    @Column(name = "vence_en", nullable = false)
    private LocalDateTime venceEn;

    @Column(name = "ultimo_error", length = 300)
    private String ultimoError;

    @Column(name = "creado_en", nullable = false)
    private LocalDateTime creadoEn;

    @Column(name = "enviado_en")
    private LocalDateTime enviadoEn;
}
