-- Repartidores.
--
-- El pedido se publica en el grupo de WhatsApp del negocio con un enlace. El
-- repartidor que lo abre se registra con su propio numero la primera vez y
-- desde entonces queda identificado: asi se sabe quien llevo cada entrega y se
-- puede pagar y reportar por persona.

CREATE TABLE IF NOT EXISTS drivers (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id   uuid         NOT NULL REFERENCES restaurants (id) ON DELETE CASCADE,
    nombre          varchar(120) NOT NULL,
    phone_number    varchar(20)  NOT NULL,
    vehiculo        varchar(40),
    activo          boolean      NOT NULL DEFAULT true,
    registrado_en   timestamp    NOT NULL DEFAULT now(),
    ultima_entrega  timestamp,

    -- El telefono identifica al repartidor dentro del restaurante. El mismo
    -- numero puede repartir para varios negocios sin mezclarse.
    CONSTRAINT ux_drivers_telefono_por_restaurante UNIQUE (restaurant_id, phone_number)
);

COMMENT ON TABLE drivers IS
    'Repartidores registrados desde el enlace que se publica en el grupo de WhatsApp.';

-- ---------------------------------------------------------------------------
-- Quien lleva cada pedido
-- ---------------------------------------------------------------------------
ALTER TABLE orders ADD COLUMN IF NOT EXISTS driver_id uuid REFERENCES drivers (id);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS asignado_en timestamp;

-- Lo que se le paga por esta entrega, congelado al tomarla: si manana cambia
-- la tarifa del repartidor, lo ya trabajado no se recalcula.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS pago_repartidor numeric(10,2);

CREATE INDEX IF NOT EXISTS ix_orders_repartidor
    ON orders (driver_id, created_at DESC)
    WHERE driver_id IS NOT NULL;

COMMENT ON COLUMN orders.pago_repartidor IS
    'Pago al repartidor por esta entrega, congelado al momento de asignarla.';
