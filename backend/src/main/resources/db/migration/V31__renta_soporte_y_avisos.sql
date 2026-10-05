-- Plataforma: historial de la renta, modo soporte y avisos al restaurante.

-- ---------------------------------------------------------------------------
-- Renta del sistema
-- ---------------------------------------------------------------------------
-- Cada cobro de la suscripcion. Los de Stripe llegan solos por webhook; los
-- de efectivo los registra el operador.
CREATE TABLE IF NOT EXISTS cobros_suscripcion (
    id              uuid           PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id   uuid           NOT NULL REFERENCES restaurants (id) ON DELETE CASCADE,
    metodo          varchar(15)    NOT NULL CHECK (metodo IN ('STRIPE', 'EFECTIVO')),
    estado          varchar(15)    NOT NULL CHECK (estado IN ('PAGADO', 'FALLIDO', 'ANULADO')),
    monto           numeric(12, 2) NOT NULL CHECK (monto >= 0),
    moneda          varchar(3)     NOT NULL DEFAULT 'MXN',
    plan            varchar(30),
    periodo_desde   date,
    periodo_hasta   date,
    -- La factura de Stripe (in_...) o el folio del recibo en efectivo.
    referencia      varchar(120),
    notas           varchar(300),
    registrado_por  varchar(120),
    pagado_en       timestamp,
    creado_en       timestamp      NOT NULL DEFAULT now(),
    anulado_motivo  varchar(300)
);
-- Un aviso de Stripe repetido no registra dos veces el mismo cobro.
CREATE UNIQUE INDEX IF NOT EXISTS ux_cobros_stripe_referencia
    ON cobros_suscripcion (referencia, estado) WHERE metodo = 'STRIPE' AND referencia IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_cobros_restaurante ON cobros_suscripcion (restaurant_id, creado_en DESC);

-- ---------------------------------------------------------------------------
-- Modo soporte
-- ---------------------------------------------------------------------------
-- Cada vez que el operador entra a ver un restaurante, con su motivo. Sin una
-- sesion abierta no ve nada del restaurante; los cambios necesitan ademas un
-- codigo que da el dueño y duran poco.
CREATE TABLE IF NOT EXISTS sesiones_soporte (
    id                uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id     uuid          NOT NULL REFERENCES restaurants (id) ON DELETE CASCADE,
    operador_id       uuid          REFERENCES users (id) ON DELETE SET NULL,
    operador_nombre   varchar(120),
    motivo            varchar(300)  NOT NULL,
    inicio            timestamp     NOT NULL DEFAULT now(),
    fin               timestamp,
    -- Hasta cuando puede hacer cambios. Null: solo lectura.
    cambios_hasta     timestamp
);
CREATE INDEX IF NOT EXISTS ix_sesiones_soporte_restaurante ON sesiones_soporte (restaurant_id, inicio DESC);

-- Lo que el operador cambio dentro de una sesion.
CREATE TABLE IF NOT EXISTS acciones_soporte (
    id          uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    sesion_id   uuid          NOT NULL REFERENCES sesiones_soporte (id) ON DELETE CASCADE,
    metodo      varchar(10)   NOT NULL,
    ruta        varchar(300)  NOT NULL,
    estado_http integer,
    en          timestamp     NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_acciones_soporte_sesion ON acciones_soporte (sesion_id);

-- El codigo con que el dueño autoriza cambios. Solo se guarda su huella;
-- sirve una vez y caduca pronto.
CREATE TABLE IF NOT EXISTS codigos_soporte (
    id             uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id  uuid         NOT NULL REFERENCES restaurants (id) ON DELETE CASCADE,
    codigo_hash    varchar(64)  NOT NULL,
    creado_por     varchar(120),
    creado_en      timestamp    NOT NULL DEFAULT now(),
    expira_en      timestamp    NOT NULL,
    usado_en       timestamp,
    sesion_id      uuid         REFERENCES sesiones_soporte (id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS ix_codigos_soporte_restaurante ON codigos_soporte (restaurant_id, creado_en DESC);

-- ---------------------------------------------------------------------------
-- Avisos del sistema al restaurante
-- ---------------------------------------------------------------------------
-- Lo que el dueño ve en la campana del panel: que entro soporte, que se
-- usaron sus codigos, cobros de la renta.
CREATE TABLE IF NOT EXISTS avisos_sistema (
    id             uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id  uuid          NOT NULL REFERENCES restaurants (id) ON DELETE CASCADE,
    tipo           varchar(20)   NOT NULL,
    titulo         varchar(150)  NOT NULL,
    detalle        varchar(500),
    creado_en      timestamp     NOT NULL DEFAULT now(),
    leido_en       timestamp
);
CREATE INDEX IF NOT EXISTS ix_avisos_sistema_restaurante ON avisos_sistema (restaurant_id, creado_en DESC);
