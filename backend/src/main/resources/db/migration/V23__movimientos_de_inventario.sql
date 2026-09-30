-- Inventario, fase 2 y 3: saber que paso con cada gramo y anticiparse.

-- ---------------------------------------------------------------------------
-- Modo de control por sucursal
-- ---------------------------------------------------------------------------
-- AVISAR:   vende aunque falte; el numero puede quedar en negativo y se avisa.
-- BLOQUEAR: no deja vender lo que no alcanza (como funcionaba antes).
-- APAGADO:  las ventas no descuentan nada; para quien aun no lleva inventario.
-- Las sucursales existentes quedan en AVISAR: que un gramo de mas no frene una venta.
ALTER TABLE branches ADD COLUMN IF NOT EXISTS control_inventario varchar(10) NOT NULL DEFAULT 'AVISAR';
ALTER TABLE branches ADD CONSTRAINT branches_control_inventario_valido
    CHECK (control_inventario IN ('AVISAR', 'BLOQUEAR', 'APAGADO'));

-- ---------------------------------------------------------------------------
-- Movimientos: el historial de cada existencia
-- ---------------------------------------------------------------------------
-- Cada cambio de existencias deja un renglon: ventas, cancelaciones, entradas
-- de mercancia, mermas, conteos fisicos y ajustes. "cantidad" es lo que cambio
-- (negativo = salio) en la unidad del inventario; "saldo" es como quedo.
CREATE TABLE IF NOT EXISTS movimientos_inventario (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id       uuid          NOT NULL REFERENCES branches (id) ON DELETE CASCADE,
    ingredient_id   uuid          REFERENCES ingredients (id) ON DELETE CASCADE,
    product_id      uuid          REFERENCES products (id) ON DELETE CASCADE,
    tipo            varchar(15)   NOT NULL,
    cantidad        numeric(12,3) NOT NULL,
    saldo           numeric(12,3) NOT NULL,
    -- Solo en entradas: cuanto costo cada unidad (kg, l, pieza).
    costo_unitario  numeric(12,4),
    proveedor       varchar(120),
    nota            varchar(300),
    order_id        uuid          REFERENCES orders (id) ON DELETE SET NULL,
    usuario         varchar(100),
    creado_en       timestamp     NOT NULL DEFAULT now(),

    CONSTRAINT movimientos_de_algo CHECK ((ingredient_id IS NULL) <> (product_id IS NULL)),
    CONSTRAINT movimientos_tipo_valido
        CHECK (tipo IN ('VENTA', 'CANCELACION', 'ENTRADA', 'MERMA', 'CONTEO', 'AJUSTE'))
);

CREATE INDEX IF NOT EXISTS ix_movimientos_ingrediente ON movimientos_inventario (branch_id, ingredient_id, creado_en DESC);
CREATE INDEX IF NOT EXISTS ix_movimientos_producto ON movimientos_inventario (branch_id, product_id, creado_en DESC);
CREATE INDEX IF NOT EXISTS ix_movimientos_tipo ON movimientos_inventario (branch_id, tipo, creado_en DESC);

-- ---------------------------------------------------------------------------
-- Lo que desconto cada linea del pedido
-- ---------------------------------------------------------------------------
-- Igual que los adicionales: si se cancela, se devuelve exactamente esto,
-- aunque la receta haya cambiado entre la venta y la cancelacion.
CREATE TABLE IF NOT EXISTS order_item_consumos (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_item_id  uuid          NOT NULL REFERENCES order_items (id) ON DELETE CASCADE,
    ingredient_id  uuid          REFERENCES ingredients (id) ON DELETE SET NULL,
    product_id     uuid          REFERENCES products (id) ON DELETE SET NULL,
    -- Total de la linea (ya multiplicado por la cantidad), en la unidad del inventario.
    cantidad       numeric(12,3) NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_order_item_consumos_item ON order_item_consumos (order_item_id);

-- ---------------------------------------------------------------------------
-- Minimo por ingrediente (alerta de "queda poco")
-- ---------------------------------------------------------------------------
ALTER TABLE ingredients ADD COLUMN IF NOT EXISTS minimo numeric(12,3);

-- ---------------------------------------------------------------------------
-- Platillos agotados a mano ("se acabo")
-- ---------------------------------------------------------------------------
-- Vale solo el dia en que se marco: al dia siguiente el platillo vuelve solo.
CREATE TABLE IF NOT EXISTS productos_agotados (
    branch_id   uuid         NOT NULL REFERENCES branches (id) ON DELETE CASCADE,
    product_id  uuid         NOT NULL REFERENCES products (id) ON DELETE CASCADE,
    desde       timestamp    NOT NULL DEFAULT now(),
    por         varchar(100),
    PRIMARY KEY (branch_id, product_id)
);
