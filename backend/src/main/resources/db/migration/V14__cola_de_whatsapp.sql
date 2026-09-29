-- Cola de mensajes de WhatsApp.
--
-- Antes cada aviso se mandaba "al aire": si el WhatsApp de la sucursal estaba
-- desconectado en ese momento, el mensaje se perdia para siempre y solo quedaba
-- una linea en el log. Ahora se guarda aqui, dentro de la misma transaccion que
-- el cambio que lo provoca, y se reintenta hasta que se envia o deja de servir.

CREATE TABLE IF NOT EXISTS mensajes_whatsapp (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id        uuid         NOT NULL REFERENCES branches (id) ON DELETE CASCADE,
    -- Telefono o id de grupo.
    destino          varchar(80)  NOT NULL,
    texto            text         NOT NULL,
    -- Para que sirve: CODIGO, ESTADO_PEDIDO, GRUPO_REPARTIDORES, ...
    motivo           varchar(30)  NOT NULL,
    -- Mensajes con la misma clave se reemplazan: si un pedido paso por tres
    -- estados mientras WhatsApp estaba caido, solo vale la pena mandar el ultimo.
    clave_reemplazo  varchar(120),
    estado           varchar(15)  NOT NULL DEFAULT 'PENDIENTE',
    intentos         integer      NOT NULL DEFAULT 0,
    proximo_intento  timestamp    NOT NULL,
    -- Pasada esta hora ya no tiene sentido mandarlo ("tu codigo es...").
    vence_en         timestamp    NOT NULL,
    ultimo_error     varchar(300),
    creado_en        timestamp    NOT NULL,
    enviado_en       timestamp,

    CONSTRAINT mensajes_estado_valido
        CHECK (estado IN ('PENDIENTE', 'ENVIANDO', 'ENVIADO', 'VENCIDO', 'REEMPLAZADO'))
);

CREATE INDEX IF NOT EXISTS ix_mensajes_por_enviar
    ON mensajes_whatsapp (proximo_intento) WHERE estado = 'PENDIENTE';
CREATE INDEX IF NOT EXISTS ix_mensajes_sucursal
    ON mensajes_whatsapp (branch_id, creado_en DESC);
