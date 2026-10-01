-- Reportes: hora en que se pidio cada platillo e indice para los rangos de fechas.

-- Cuando se pidio el platillo. Con esto el tiempo de cocina se mide desde que
-- se pidio cada platillo y no desde que se abrio la cuenta: lo que se agregaba
-- una hora despues salia como "tardado". Los renglones viejos quedan en null.
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS created_at TIMESTAMP;
ALTER TABLE order_items ALTER COLUMN created_at SET DEFAULT now();

CREATE INDEX IF NOT EXISTS ix_orders_sucursal_cierre
    ON orders (branch_id, closed_at) WHERE status = 'CLOSED';
