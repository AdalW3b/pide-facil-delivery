-- Cuentas para clientes y repartidores.
--
-- Hasta ahora los dos existian como fichas sin acceso: el sistema guardaba su
-- historial pero ellos no podian consultarlo. Esta migracion les da credenciales
-- sobre la MISMA ficha que ya tenian, para que al registrarse recuperen lo que
-- ya habian pedido o repartido en vez de empezar de cero.
--
-- La cuenta es por restaurante, igual que la ficha: el telefono ya era unico
-- dentro de cada restaurante y asi no hay que inventar una identidad global.

ALTER TABLE customers ADD COLUMN IF NOT EXISTS password_hash    varchar(100);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS email            varchar(160);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS cuenta_creada_en timestamp;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS ultimo_acceso    timestamp;

ALTER TABLE drivers   ADD COLUMN IF NOT EXISTS password_hash    varchar(100);
ALTER TABLE drivers   ADD COLUMN IF NOT EXISTS email            varchar(160);
ALTER TABLE drivers   ADD COLUMN IF NOT EXISTS cuenta_creada_en timestamp;
ALTER TABLE drivers   ADD COLUMN IF NOT EXISTS ultimo_acceso    timestamp;

COMMENT ON COLUMN customers.password_hash IS
    'Null mientras el cliente no abra cuenta: la ficha sigue sirviendo para el bot y el menu web.';

-- ---------------------------------------------------------------------------
-- Codigos para comprobar que el telefono es suyo
-- ---------------------------------------------------------------------------
-- Sin esto, cualquiera podria abrir cuenta con el telefono de otro y quedarse
-- con su historial, sus direcciones y el pin de su casa. El codigo llega por
-- WhatsApp al numero que se esta reclamando, que es la unica forma de saber
-- que quien registra es quien dice ser.
CREATE TABLE IF NOT EXISTS codigos_verificacion (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id  uuid         NOT NULL REFERENCES restaurants (id) ON DELETE CASCADE,
    -- CLIENTE o REPARTIDOR: el mismo telefono puede ser ambas cosas.
    tipo           varchar(20)  NOT NULL,
    phone_number   varchar(20)  NOT NULL,
    -- Se guarda el hash, no el codigo: quien lea la base no debe poder entrar.
    codigo_hash    varchar(100) NOT NULL,
    expira_en      timestamp    NOT NULL,
    intentos       integer      NOT NULL DEFAULT 0,
    usado_en       timestamp,
    creado_en      timestamp    NOT NULL DEFAULT now(),

    CONSTRAINT codigos_tipo_valido CHECK (tipo IN ('CLIENTE', 'REPARTIDOR'))
);

-- Solo se consulta el codigo vigente de un telefono, y siempre por los tres
-- campos juntos.
CREATE INDEX IF NOT EXISTS ix_codigos_vigentes
    ON codigos_verificacion (restaurant_id, tipo, phone_number, expira_en DESC);

COMMENT ON TABLE codigos_verificacion IS
    'Codigos de un solo uso para comprobar que el telefono pertenece a quien abre la cuenta.';
