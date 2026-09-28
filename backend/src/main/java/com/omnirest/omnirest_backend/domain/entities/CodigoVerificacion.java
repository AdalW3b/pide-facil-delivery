package com.omnirest.omnirest_backend.domain.entities;

import com.omnirest.omnirest_backend.domain.enums.TipoCuenta;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Un codigo de un solo uso para comprobar que el telefono es de quien abre la
 * cuenta. Se guarda el hash, nunca el codigo.
 */
@Entity
@jakarta.persistence.Table(name = "codigos_verificacion")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CodigoVerificacion {

    /** Cuantas veces se puede fallar antes de tener que pedir otro codigo. */
    public static final int INTENTOS_MAXIMOS = 5;

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "restaurant_id", nullable = false)
    private UUID restaurantId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private TipoCuenta tipo;

    @Column(name = "phone_number", nullable = false, length = 20)
    private String phoneNumber;

    @Column(name = "codigo_hash", nullable = false, length = 100)
    private String codigoHash;

    @Column(name = "expira_en", nullable = false)
    private LocalDateTime expiraEn;

    @Builder.Default
    private Integer intentos = 0;

    @Column(name = "usado_en")
    private LocalDateTime usadoEn;

    @Column(name = "creado_en", insertable = false, updatable = false)
    private LocalDateTime creadoEn;

    /** Sigue sirviendo: no se ha usado, no expiro y no se agotaron los intentos. */
    public boolean vigente() {
        return usadoEn == null
                && expiraEn.isAfter(LocalDateTime.now())
                && (intentos == null || intentos < INTENTOS_MAXIMOS);
    }
}
