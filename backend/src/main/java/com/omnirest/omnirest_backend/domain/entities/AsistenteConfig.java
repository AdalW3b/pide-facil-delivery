package com.omnirest.omnirest_backend.domain.entities;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

/** El asistente operativo de un restaurante: si lo contrató, con qué proveedor y con qué llave. */
@Entity
@jakarta.persistence.Table(name = "asistente_config")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AsistenteConfig {

    public enum Proveedor { ANTHROPIC, OPENAI, GEMINI, COMPATIBLE }

    @Id
    @Column(name = "restaurant_id")
    private UUID restaurantId;

    /** El complemento contratado; lo activa el operador de la plataforma. */
    @Builder.Default
    @Column(name = "complemento_activo", nullable = false)
    private Boolean complementoActivo = false;

    @Enumerated(EnumType.STRING)
    @Column(length = 20)
    private Proveedor proveedor;

    @Column(length = 100)
    private String modelo;

    /** Solo servicios compatibles con OpenAI. */
    @Column(name = "url_base", length = 300)
    private String urlBase;

    /** Cifrada con la llave maestra del servidor. Nunca sale del backend. */
    @Column(name = "llave_cifrada", columnDefinition = "text")
    private String llaveCifrada;

    @Column(name = "llave_final", length = 8)
    private String llaveFinal;

    @Builder.Default
    @Column(name = "resumen_diario", nullable = false)
    private Boolean resumenDiario = true;

    @Column(name = "actualizado_en")
    private LocalDateTime actualizadoEn;

    @Column(name = "actualizado_por", length = 120)
    private String actualizadoPor;

    public boolean configurado() {
        return proveedor != null && modelo != null && !modelo.isBlank() && llaveCifrada != null
                && (proveedor != Proveedor.COMPATIBLE || (urlBase != null && !urlBase.isBlank()));
    }
}
