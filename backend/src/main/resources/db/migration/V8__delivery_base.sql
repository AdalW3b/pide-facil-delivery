-- Base del modulo de delivery: tarifas por sucursal, direcciones del cliente y
-- los datos de entrega en el pedido.
--
-- Esta migracion NO incluye repartidores ni adicionales: van aparte para poder
-- revisar cada bloque por separado.

-- ---------------------------------------------------------------------------
-- 1. Configuracion de delivery por sucursal
-- ---------------------------------------------------------------------------
-- Todos los parametros de la tarifa viven aqui, no en el codigo: cada sucursal
-- decide cuanto absorbe y hasta donde reparte.
CREATE TABLE IF NOT EXISTS branch_delivery_settings (
    branch_id            uuid PRIMARY KEY REFERENCES branches (id) ON DELETE CASCADE,
    activo               boolean       NOT NULL DEFAULT false,
    -- Ubicacion de la sucursal, desde donde se mide la distancia.
    latitud              numeric(10,7),
    longitud             numeric(10,7),
    -- Tramo base: los primeros km, con su tarifa.
    km_incluidos         numeric(5,2)  NOT NULL DEFAULT 3.00,
    tarifa_base          numeric(10,2) NOT NULL DEFAULT 40.00,
    -- Que parte de cada tramo absorbe el restaurante (0.00 a 1.00).
    pct_base_absorbe     numeric(4,3)  NOT NULL DEFAULT 1.000,
    precio_km_extra      numeric(10,2) NOT NULL DEFAULT 10.00,
    pct_extra_absorbe    numeric(4,3)  NOT NULL DEFAULT 0.000,
    -- Escalon de cobro: 1 km cobra kilometros enteros; 0.5 cobra medios.
    redondeo_km          numeric(4,2)  NOT NULL DEFAULT 1.00,
    distancia_maxima_km  numeric(5,2)  NOT NULL DEFAULT 8.00,
    -- Cuando el servicio de rutas no responde se usa la linea recta por este
    -- factor, para que un pedido nunca se quede bloqueado.
    factor_calles        numeric(4,2)  NOT NULL DEFAULT 1.30,
    pedido_minimo        numeric(10,2) NOT NULL DEFAULT 0.00,
    minutos_estimados    integer       NOT NULL DEFAULT 40,
    -- Grupo de WhatsApp donde se publican los pedidos para los repartidores.
    grupo_repartidores   varchar(120),
    -- Lo que se le paga al repartidor por entrega.
    pago_repartidor_fijo numeric(10,2) NOT NULL DEFAULT 12.00,
    pago_repartidor_km   numeric(10,2) NOT NULL DEFAULT 6.00,
    creado_en            timestamp     NOT NULL DEFAULT now(),
    actualizado_en       timestamp     NOT NULL DEFAULT now(),

    CONSTRAINT bds_porcentajes_validos
        CHECK (pct_base_absorbe BETWEEN 0 AND 1 AND pct_extra_absorbe BETWEEN 0 AND 1),
    CONSTRAINT bds_valores_positivos
        CHECK (km_incluidos >= 0 AND tarifa_base >= 0 AND precio_km_extra >= 0
               AND redondeo_km > 0 AND distancia_maxima_km > 0 AND factor_calles >= 1),
    CONSTRAINT bds_coordenadas_completas
        CHECK ((latitud IS NULL AND longitud IS NULL) OR (latitud IS NOT NULL AND longitud IS NOT NULL))
);

COMMENT ON TABLE branch_delivery_settings IS
    'Parametros de delivery por sucursal: tarifa por distancia, cobertura y pago al repartidor.';

-- ---------------------------------------------------------------------------
-- 2. Direcciones del cliente
-- ---------------------------------------------------------------------------
-- Un cliente puede guardar varias ("Casa", "Oficina") y reusarlas. El pin es lo
-- que el repartidor abrira en su mapa, asi que las coordenadas son obligatorias.
CREATE TABLE IF NOT EXISTS customer_addresses (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id    uuid          NOT NULL REFERENCES customers (id) ON DELETE CASCADE,
    alias          varchar(60),
    direccion      varchar(300)  NOT NULL,
    referencias    varchar(300),
    latitud        numeric(10,7) NOT NULL,
    longitud       numeric(10,7) NOT NULL,
    es_principal   boolean       NOT NULL DEFAULT false,
    activa         boolean       NOT NULL DEFAULT true,
    creada_en      timestamp     NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_customer_addresses_cliente
    ON customer_addresses (customer_id) WHERE activa;

COMMENT ON TABLE customer_addresses IS
    'Direcciones guardadas del cliente, con el pin que usara el repartidor.';

-- ---------------------------------------------------------------------------
-- 3. Datos de entrega en el pedido
-- ---------------------------------------------------------------------------
-- El pedido deja de ser siempre de salon: ahora puede ser a domicilio o para
-- llevar, y en esos casos no tiene mesa.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_type varchar(20) NOT NULL DEFAULT 'SALON';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_status varchar(20);

-- Direccion y pin copiados al momento de pedir: si el cliente luego edita su
-- direccion, el pedido conserva a donde se llevo realmente.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS direccion_entrega varchar(300);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS referencias_entrega varchar(300);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS latitud_entrega numeric(10,7);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS longitud_entrega numeric(10,7);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS notas_entrega varchar(300);

-- Importes del envio, congelados al confirmar. Si la sucursal cambia su tarifa
-- manana, este pedido no se recalcula, igual que el precio de los platos.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS distancia_km numeric(6,2);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS envio_total numeric(10,2);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS envio_absorbido numeric(10,2);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS envio_cobrado numeric(10,2);

ALTER TABLE orders ADD COLUMN IF NOT EXISTS paga_con numeric(10,2);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS propina numeric(10,2);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS minutos_estimados integer;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS token_seguimiento varchar(40);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS recogido_en timestamp;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS entregado_en timestamp;

CREATE UNIQUE INDEX IF NOT EXISTS ux_orders_token_seguimiento
    ON orders (token_seguimiento) WHERE token_seguimiento IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_orders_delivery_activos
    ON orders (branch_id, delivery_status)
    WHERE order_type <> 'SALON' AND status = 'OPEN';

-- La mesa deja de ser obligatoria, pero solo para los pedidos que no son de
-- salon: un pedido de salon sin mesa seguiria siendo un error.
ALTER TABLE orders ALTER COLUMN table_id DROP NOT NULL;

ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_tipo_valido;
ALTER TABLE orders ADD CONSTRAINT orders_tipo_valido
    CHECK (order_type IN ('SALON', 'DOMICILIO', 'PARA_LLEVAR'));

ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_salon_con_mesa;
ALTER TABLE orders ADD CONSTRAINT orders_salon_con_mesa
    CHECK (order_type <> 'SALON' OR table_id IS NOT NULL);

ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_domicilio_con_pin;
ALTER TABLE orders ADD CONSTRAINT orders_domicilio_con_pin
    CHECK (order_type <> 'DOMICILIO'
           OR (latitud_entrega IS NOT NULL AND longitud_entrega IS NOT NULL));

COMMENT ON COLUMN orders.order_type IS 'SALON, DOMICILIO o PARA_LLEVAR.';
COMMENT ON COLUMN orders.envio_absorbido IS 'Parte del envio que paga el restaurante.';
COMMENT ON COLUMN orders.envio_cobrado IS 'Parte del envio que paga el cliente.';
