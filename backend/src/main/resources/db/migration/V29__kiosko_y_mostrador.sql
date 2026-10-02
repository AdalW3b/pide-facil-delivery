-- Kiosko y pedidos de mostrador.
--
-- El cliente pide solo, en una tablet de la sucursal (kiosko) o desde su
-- celular para pasar a recoger. Cada pedido de mostrador lleva un turno
-- (A-023) para llamarlo, y dice si se come aqui o se lleva.

ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_origen_valido;
ALTER TABLE orders ADD CONSTRAINT orders_origen_valido
    CHECK (origen IS NULL OR origen IN ('WEB', 'TELEFONO', 'WHATSAPP', 'SALON', 'RAPPI', 'KIOSKO'));

-- El numero con que se llama al cliente en mostrador. Se reinicia cada dia.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS turno varchar(10);

-- Si se come en la sucursal o se lleva: cocina emplata o empaca.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS consumo varchar(10);
ALTER TABLE orders ADD CONSTRAINT orders_consumo_valido
    CHECK (consumo IS NULL OR consumo IN ('AQUI', 'LLEVAR'));

-- El ultimo turno dado por sucursal y dia. Se incrementa con un solo
-- INSERT ... ON CONFLICT, asi dos kioscos a la vez no sacan el mismo numero.
CREATE TABLE IF NOT EXISTS contador_turnos (
    branch_id  uuid     NOT NULL REFERENCES branches (id) ON DELETE CASCADE,
    dia        date     NOT NULL,
    ultimo     integer  NOT NULL,
    PRIMARY KEY (branch_id, dia)
);

-- Las tablets activadas como kiosko. Del token solo se guarda su huella: si
-- alguien lee la base no puede hacerse pasar por un kiosko.
CREATE TABLE IF NOT EXISTS kioscos (
    id           uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id    uuid          NOT NULL REFERENCES branches (id) ON DELETE CASCADE,
    nombre       varchar(60)   NOT NULL,
    token_hash   varchar(64)   NOT NULL UNIQUE,
    activo       boolean       NOT NULL DEFAULT true,
    creado_por   varchar(120),
    creado_en    timestamp     NOT NULL DEFAULT now(),
    ultimo_uso   timestamp
);
CREATE INDEX IF NOT EXISTS ix_kioscos_sucursal ON kioscos (branch_id);
