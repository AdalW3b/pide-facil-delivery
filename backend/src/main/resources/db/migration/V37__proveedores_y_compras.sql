-- Compras como llegan del proveedor.
--
-- Antes el proveedor era texto libre (casi todo quedaba "Sin proveedor"), la
-- compra no decia como se pago (el efectivo que salia de la caja no quedaba en
-- el arqueo), habia que convertir a mano "2 cajas" en piezas y una compra mal
-- capturada no se podia corregir.

-- Proveedores del restaurante. No se borran si tienen compras: se desactivan.
CREATE TABLE IF NOT EXISTS proveedores (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id  uuid          NOT NULL REFERENCES restaurants (id) ON DELETE CASCADE,
    nombre         varchar(120)  NOT NULL,
    contacto       varchar(120),
    telefono       varchar(30),
    -- Para el vencimiento de lo que se compra a credito.
    dias_credito   integer       NOT NULL DEFAULT 0 CHECK (dias_credito >= 0),
    -- Dias que visita: "LUN,JUE".
    dias_visita    varchar(40),
    notas          varchar(300),
    activo         boolean       NOT NULL DEFAULT true,
    creado_en      timestamp     NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_proveedores_nombre ON proveedores (restaurant_id, lower(nombre));

-- Que surte cada proveedor: la lista de compras sabe a quien pedirle cada cosa.
CREATE TABLE IF NOT EXISTS proveedor_articulos (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    proveedor_id  uuid NOT NULL REFERENCES proveedores (id) ON DELETE CASCADE,
    ingredient_id uuid REFERENCES ingredients (id) ON DELETE CASCADE,
    product_id    uuid REFERENCES products (id) ON DELETE CASCADE,
    CONSTRAINT proveedor_articulo_uno CHECK ((ingredient_id IS NULL) <> (product_id IS NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_proveedor_ingrediente ON proveedor_articulos (proveedor_id, ingredient_id) WHERE ingredient_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_proveedor_producto ON proveedor_articulos (proveedor_id, product_id) WHERE product_id IS NOT NULL;

-- Como lo vende el proveedor: "caja de 24" = 24 piezas, "costal" = 20 kg.
-- El factor esta en la unidad en que se lleva el inventario del articulo.
CREATE TABLE IF NOT EXISTS presentaciones_compra (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    ingredient_id uuid REFERENCES ingredients (id) ON DELETE CASCADE,
    product_id    uuid REFERENCES products (id) ON DELETE CASCADE,
    nombre        varchar(60)   NOT NULL,
    factor        numeric(12,3) NOT NULL CHECK (factor > 0),
    CONSTRAINT presentacion_articulo_uno CHECK ((ingredient_id IS NULL) <> (product_id IS NULL))
);
CREATE INDEX IF NOT EXISTS ix_presentaciones_ingrediente ON presentaciones_compra (ingredient_id);
CREATE INDEX IF NOT EXISTS ix_presentaciones_producto ON presentaciones_compra (product_id);

-- La nota: proveedor, folio, fecha, como se pago, IVA y si se anulo.
ALTER TABLE compras ADD COLUMN IF NOT EXISTS proveedor_id uuid REFERENCES proveedores (id) ON DELETE SET NULL;
ALTER TABLE compras ADD COLUMN IF NOT EXISTS folio varchar(40);
ALTER TABLE compras ADD COLUMN IF NOT EXISTS fecha date;
-- CAJA (efectivo del cajon), TRANSFERENCIA o CREDITO.
ALTER TABLE compras ADD COLUMN IF NOT EXISTS forma_pago varchar(15);
-- INCLUIDO (los precios ya traen IVA), APARTE (se suma al final) o SIN.
ALTER TABLE compras ADD COLUMN IF NOT EXISTS iva varchar(10);
ALTER TABLE compras ADD COLUMN IF NOT EXISTS subtotal numeric(12,2);
ALTER TABLE compras ADD COLUMN IF NOT EXISTS iva_monto numeric(12,2);
-- A credito: cuando vence y cuando se pago.
ALTER TABLE compras ADD COLUMN IF NOT EXISTS vence date;
ALTER TABLE compras ADD COLUMN IF NOT EXISTS pagada_en timestamp;
-- "2 caja de 24 Coca-Cola 355 ml · 5 kg Arrachera", como venia en la nota.
ALTER TABLE compras ADD COLUMN IF NOT EXISTS detalle varchar(1000);
-- La salida de efectivo que se registro en la caja.
ALTER TABLE compras ADD COLUMN IF NOT EXISTS movimiento_caja_id uuid;
ALTER TABLE compras ADD COLUMN IF NOT EXISTS anulada_en timestamp;
ALTER TABLE compras ADD COLUMN IF NOT EXISTS anulada_por varchar(100);
ALTER TABLE compras ADD COLUMN IF NOT EXISTS motivo_anulacion varchar(300);

UPDATE compras SET fecha = creado_en::date WHERE fecha IS NULL;
