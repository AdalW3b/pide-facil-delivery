-- El carrito del bot de WhatsApp.
--
-- Antes el pedido vivia en la memoria de la IA de n8n: si el cliente
-- confirmaba y agregaba algo en el mismo mensaje ("Si, aparte una tlayuda"),
-- la IA solo mandaba lo ultimo y lo anterior se perdia. Ahora el bot va
-- guardando aqui cada platillo y, al confirmar, se manda a cocina todo lo
-- que hay en el carrito.

CREATE TABLE IF NOT EXISTS carritos_bot (
    id              uuid         PRIMARY KEY,
    branch_id       uuid         NOT NULL REFERENCES branches (id) ON DELETE CASCADE,
    telefono        varchar(20)  NOT NULL,
    table_number    integer,
    actualizado_en  timestamp    NOT NULL DEFAULT now(),
    CONSTRAINT uq_carrito_bot_cliente UNIQUE (branch_id, telefono)
);

COMMENT ON TABLE carritos_bot IS
    'Lo que el cliente va pidiendo por WhatsApp antes de confirmar. Uno por cliente y sucursal; se vacia al confirmar y caduca solo.';

CREATE TABLE IF NOT EXISTS carrito_bot_items (
    id             uuid          PRIMARY KEY,
    carrito_id     uuid          NOT NULL REFERENCES carritos_bot (id) ON DELETE CASCADE,
    product_id     uuid          NOT NULL REFERENCES products (id) ON DELETE CASCADE,
    cantidad       integer       NOT NULL CHECK (cantidad > 0),
    -- Nombres de los adicionales tal como los dijo el cliente, uno por linea.
    adicionales    text,
    instrucciones  varchar(300),
    creado_en      timestamp     NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_carrito_bot_items_carrito ON carrito_bot_items (carrito_id);
