-- Pagos en linea con Stripe Connect (fase 0: la base).
-- El cliente paga con tarjeta desde el menu en linea y el dinero llega a la
-- cuenta de Stripe del restaurante. Pide Facil no guarda tarjetas ni llaves
-- secretas de los restaurantes: solo el ID de su cuenta conectada.

-- La cuenta de Stripe de cada restaurante y como cobra en linea.
CREATE TABLE IF NOT EXISTS pagos_linea_config (
    restaurant_id            uuid          PRIMARY KEY REFERENCES restaurants (id) ON DELETE CASCADE,
    stripe_account_id        varchar(60)   UNIQUE,
    -- SIN_CONECTAR, PENDIENTE (Stripe pide datos), LISTA, DETENIDA (Stripe detuvo los cobros)
    estado_cuenta            varchar(20)   NOT NULL DEFAULT 'SIN_CONECTAR',
    motivo_estado            varchar(300),
    activo                   boolean       NOT NULL DEFAULT false,
    modo_prueba              boolean       NOT NULL DEFAULT true,
    acepta_tarjeta           boolean       NOT NULL DEFAULT true,
    acepta_efectivo          boolean       NOT NULL DEFAULT true,
    acepta_en_tienda         boolean       NOT NULL DEFAULT true,
    -- Lo que se queda Pide Facil de cada pago, segun el trato con el dueno.
    -- 0 = solo la renta mensual. Lo fija el operador de la plataforma.
    comision_plataforma_pct  numeric(5, 2) NOT NULL DEFAULT 0
        CHECK (comision_plataforma_pct >= 0 AND comision_plataforma_pct <= 30),
    conectado_en             timestamp,
    actualizado_en           timestamp     NOT NULL DEFAULT now()
);

-- Cada cobro en linea (un PaymentIntent de Stripe).
CREATE TABLE IF NOT EXISTS transacciones_linea (
    id                   uuid           PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id        uuid           NOT NULL REFERENCES restaurants (id) ON DELETE CASCADE,
    branch_id            uuid           NOT NULL REFERENCES branches (id) ON DELETE CASCADE,
    order_id             uuid           NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
    stripe_account_id    varchar(60)    NOT NULL,
    payment_intent_id    varchar(80)    UNIQUE,
    -- La misma clave en un reintento devuelve el mismo cobro: nunca se cobra doble.
    clave_idempotencia   varchar(80)    NOT NULL UNIQUE,
    -- PENDIENTE, PROCESANDO, PAGADO, FALLIDO, CANCELADO, REEMBOLSADO, REEMBOLSO_PARCIAL
    estado               varchar(20)    NOT NULL DEFAULT 'PENDIENTE',
    moneda               varchar(3)     NOT NULL DEFAULT 'mxn',
    -- Lo que se le cobra al cliente, propina incluida.
    monto                numeric(12, 2) NOT NULL CHECK (monto > 0),
    propina              numeric(12, 2) NOT NULL DEFAULT 0 CHECK (propina >= 0),
    monto_reembolsado    numeric(12, 2) NOT NULL DEFAULT 0 CHECK (monto_reembolsado >= 0),
    comision_stripe      numeric(12, 2),
    comision_plataforma  numeric(12, 2) NOT NULL DEFAULT 0,
    marca_tarjeta        varchar(20),
    ultimos4             varchar(4),
    -- Telefono enmascarado del cliente, para buscarlo sin exponerlo.
    cliente_ref          varchar(40),
    error                varchar(300),
    expira_en            timestamp,
    pagado_en            timestamp,
    creado_en            timestamp      NOT NULL DEFAULT now(),
    actualizado_en       timestamp      NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_transacciones_linea_restaurante ON transacciones_linea (restaurant_id, creado_en DESC);
CREATE INDEX IF NOT EXISTS ix_transacciones_linea_pedido ON transacciones_linea (order_id);
CREATE INDEX IF NOT EXISTS ix_transacciones_linea_pendientes ON transacciones_linea (expira_en)
    WHERE estado IN ('PENDIENTE', 'PROCESANDO');

CREATE TABLE IF NOT EXISTS reembolsos_linea (
    id                uuid           PRIMARY KEY DEFAULT gen_random_uuid(),
    transaccion_id    uuid           NOT NULL REFERENCES transacciones_linea (id) ON DELETE CASCADE,
    stripe_refund_id  varchar(80)    UNIQUE,
    monto             numeric(12, 2) NOT NULL CHECK (monto > 0),
    motivo            varchar(300),
    -- PENDIENTE, HECHO, FALLIDO
    estado            varchar(20)    NOT NULL DEFAULT 'PENDIENTE',
    hecho_por         varchar(120),
    creado_en         timestamp      NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_reembolsos_linea_transaccion ON reembolsos_linea (transaccion_id);

-- Cada evento que manda Stripe, guardado antes de procesarlo. El ID del evento
-- es la llave: si Stripe lo repite, no se procesa dos veces.
CREATE TABLE IF NOT EXISTS eventos_stripe (
    id               varchar(80)   PRIMARY KEY,
    tipo             varchar(80)   NOT NULL,
    -- La cuenta conectada que lo origino (acct_...); vacio si es de la plataforma.
    cuenta           varchar(60),
    livemode         boolean       NOT NULL DEFAULT false,
    payload          text          NOT NULL,
    -- PENDIENTE, PROCESANDO, PROCESADO, IGNORADO, FALLIDO
    estado           varchar(12)   NOT NULL DEFAULT 'PENDIENTE',
    intentos         int           NOT NULL DEFAULT 0,
    proximo_intento  timestamp     NOT NULL DEFAULT now(),
    error            varchar(500),
    recibido_en      timestamp     NOT NULL DEFAULT now(),
    procesado_en     timestamp
);
CREATE INDEX IF NOT EXISTS ix_eventos_stripe_pendientes ON eventos_stripe (proximo_intento)
    WHERE estado IN ('PENDIENTE', 'PROCESANDO');

-- Quien hizo que: conectar, activar, cambiar la comision, reembolsar.
CREATE TABLE IF NOT EXISTS bitacora_pagos_linea (
    id             uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id  uuid          NOT NULL REFERENCES restaurants (id) ON DELETE CASCADE,
    accion         varchar(40)   NOT NULL,
    detalle        varchar(500),
    usuario        varchar(120),
    en             timestamp     NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_bitacora_pagos_linea ON bitacora_pagos_linea (restaurant_id, en DESC);

-- Un pago en linea puede llegar con la caja cerrada: no pertenece a ningun
-- turno y no toca el efectivo del arqueo.
ALTER TABLE pagos ALTER COLUMN turno_id DROP NOT NULL;
ALTER TABLE pagos ADD COLUMN IF NOT EXISTS transaccion_linea_id uuid
    REFERENCES transacciones_linea (id) ON DELETE SET NULL;
