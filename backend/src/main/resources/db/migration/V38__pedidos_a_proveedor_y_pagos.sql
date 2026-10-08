-- Pedir al proveedor, recibir contra lo pedido y pagar lo que se compro a credito.

-- Lo que se le pidio a un proveedor. Cuando llega se recibe: se registra la
-- compra con lo que llego y queda anotado lo que falto o llego mal.
CREATE TABLE IF NOT EXISTS pedidos_proveedor (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id     uuid          NOT NULL REFERENCES branches (id) ON DELETE CASCADE,
    proveedor_id  uuid          REFERENCES proveedores (id) ON DELETE SET NULL,
    -- El nombre como se pidio (se conserva aunque el proveedor cambie).
    proveedor     varchar(120)  NOT NULL,
    -- Para cuando se necesita.
    para          date,
    nota          varchar(300),
    -- PENDIENTE, RECIBIDO o CANCELADO.
    estado        varchar(12)   NOT NULL DEFAULT 'PENDIENTE',
    compra_id     uuid          REFERENCES compras (id) ON DELETE SET NULL,
    creado_por    varchar(100),
    creado_en     timestamp     NOT NULL DEFAULT now(),
    cerrado_en    timestamp
);
CREATE INDEX IF NOT EXISTS ix_pedidos_proveedor_sucursal ON pedidos_proveedor (branch_id, creado_en DESC);

CREATE TABLE IF NOT EXISTS pedido_proveedor_renglones (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    pedido_id        uuid          NOT NULL REFERENCES pedidos_proveedor (id) ON DELETE CASCADE,
    ingredient_id    uuid          REFERENCES ingredients (id) ON DELETE CASCADE,
    product_id       uuid          REFERENCES products (id) ON DELETE CASCADE,
    -- Como se pidio: 10 kg, o 2 "caja de 24".
    cantidad         numeric(12,3) NOT NULL CHECK (cantidad > 0),
    unidad           varchar(20),
    presentacion_id  uuid          REFERENCES presentaciones_compra (id) ON DELETE SET NULL,
    -- "2 caja de 24 Coca-Cola 355 ml", tal como salio en el mensaje.
    descripcion      varchar(200)  NOT NULL,
    -- Al recibir: cuanto llego (en la misma unidad o presentacion) y por que falto.
    recibido         numeric(12,3),
    -- FALTO o MAL_ESTADO.
    motivo           varchar(12),
    orden            integer       NOT NULL DEFAULT 0,
    CONSTRAINT pedido_renglon_articulo_uno CHECK ((ingredient_id IS NULL) <> (product_id IS NULL))
);
CREATE INDEX IF NOT EXISTS ix_pedido_renglones_pedido ON pedido_proveedor_renglones (pedido_id);

-- La compra que salio de un pedido, y como se pago despues lo comprado a credito.
ALTER TABLE compras ADD COLUMN IF NOT EXISTS pedido_id uuid;
-- CAJA o TRANSFERENCIA.
ALTER TABLE compras ADD COLUMN IF NOT EXISTS pago_forma varchar(15);
ALTER TABLE compras ADD COLUMN IF NOT EXISTS pago_movimiento_caja_id uuid;
ALTER TABLE compras ADD COLUMN IF NOT EXISTS pagada_por varchar(100);
UPDATE compras SET pago_forma = forma_pago WHERE pagada_en IS NOT NULL AND forma_pago IN ('CAJA', 'TRANSFERENCIA') AND pago_forma IS NULL;
