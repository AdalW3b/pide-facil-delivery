-- Pedidos que llegan de Rappi.
--
-- Rappi avisa por webhook cada pedido nuevo y el pedido entra al tablero de
-- Domicilio como cualquier otro, para aceptarlo o rechazarlo ahi mismo.

ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_origen_valido;
ALTER TABLE orders ADD CONSTRAINT orders_origen_valido
    CHECK (origen IS NULL OR origen IN ('WEB', 'TELEFONO', 'WHATSAPP', 'SALON', 'RAPPI'));

-- Lo que trae un pedido de otra plataforma y no cabe en nuestras columnas: el
-- cliente no es nuestro (no se guarda en customers ni recibe WhatsApp) y el
-- numero de pedido es el de la plataforma, que es el que se dicta al repartidor.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cliente_externo varchar(120);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS pedido_externo varchar(40);

-- El inventario de estos pedidos se descuenta al aceptarlos, no al recibirlos:
-- un pedido de Rappi llega aunque algo se haya acabado, y es al aceptar cuando
-- hay que frenarlo para rechazarlo.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS descontar_al_aceptar boolean NOT NULL DEFAULT false;

-- Lo lleva el repartidor de la plataforma: no se ofrece en el grupo de
-- repartidores ni entra al cuadre.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS reparto_externo boolean NOT NULL DEFAULT false;

-- Que tienda de Rappi es cada sucursal.
CREATE TABLE IF NOT EXISTS rappi_tiendas (
    branch_id       uuid         PRIMARY KEY REFERENCES branches (id) ON DELETE CASCADE,
    store_id        varchar(40)  NOT NULL UNIQUE,
    -- Lo ultimo que dijo Rappi en STORE_CONNECTIVITY. Null mientras no avise.
    habilitada      boolean,
    mensaje         varchar(300),
    ligada_en       timestamp    NOT NULL DEFAULT now(),
    actualizada_en  timestamp
);

-- Lo propio de Rappi de cada pedido. El JSON completo se guarda para revisar
-- un pedido que llego mal sin depender de los registros de Rappi.
CREATE TABLE IF NOT EXISTS pedidos_rappi (
    order_id            uuid           PRIMARY KEY REFERENCES orders (id) ON DELETE CASCADE,
    rappi_order_id      varchar(40)    NOT NULL UNIQUE,
    store_id            varchar(40)    NOT NULL,
    metodo_entrega      varchar(20),
    metodo_pago         varchar(30),
    -- Lo que Rappi le paga al restaurante por este pedido (total_order).
    total_rappi         numeric(12, 2),
    -- Efectivo que el cliente paga en mostrador o al repartidor propio.
    efectivo_a_cobrar   numeric(12, 2),
    minutos_cocina      integer,
    minutos_cocina_min  integer,
    minutos_cocina_max  integer,
    -- Platillos que no se pudieron ligar al menu: llegan como aviso.
    sin_ligar           text,
    ultimo_evento       varchar(60),
    ultimo_evento_en    timestamp,
    repartidor          varchar(120),
    recibido_en         timestamp      NOT NULL DEFAULT now(),
    payload             jsonb          NOT NULL
);
