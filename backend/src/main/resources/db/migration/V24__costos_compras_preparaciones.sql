-- Inventario, fase 3 y 4: costos y margen, compras, conteo por zona,
-- preparaciones, transferencias y una pantalla propia con su permiso.

-- ---------------------------------------------------------------------------
-- Costos
-- ---------------------------------------------------------------------------
-- Costo promedio por unidad del inventario (kg, l, pieza). Se recalcula con
-- cada entrada que traiga costo, o se escribe a mano.
ALTER TABLE ingredients ADD COLUMN IF NOT EXISTS costo_promedio numeric(12,4);
-- Productos terminados (refrescos): su propio costo y minimo, igual que un ingrediente.
ALTER TABLE products ADD COLUMN IF NOT EXISTS costo_promedio numeric(12,4);
ALTER TABLE products ADD COLUMN IF NOT EXISTS minimo integer;

-- ---------------------------------------------------------------------------
-- Conteo por zona: "Refri", "Almacén", "Barra"
-- ---------------------------------------------------------------------------
ALTER TABLE ingredients ADD COLUMN IF NOT EXISTS zona varchar(40);
ALTER TABLE products ADD COLUMN IF NOT EXISTS zona varchar(40);

-- ---------------------------------------------------------------------------
-- Preparaciones: salsas, frijoles, carne marinada
-- ---------------------------------------------------------------------------
-- Un ingrediente preparado se hace con otros. La receta es de una tanda y
-- "rinde" dice cuanto sale de ella, en la unidad del preparado: de 1 kg de
-- tomatillo + 100 g de chile salen 1.2 l de salsa.
ALTER TABLE ingredients ADD COLUMN IF NOT EXISTS es_preparado boolean NOT NULL DEFAULT false;
ALTER TABLE ingredients ADD COLUMN IF NOT EXISTS rinde numeric(12,3);

CREATE TABLE IF NOT EXISTS preparacion_componentes (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    preparado_id   uuid          NOT NULL REFERENCES ingredients (id) ON DELETE CASCADE,
    -- RESTRICT: no se borra un ingrediente que se usa en una preparacion.
    componente_id  uuid          NOT NULL REFERENCES ingredients (id) ON DELETE RESTRICT,
    cantidad       numeric(12,3) NOT NULL CHECK (cantidad > 0),
    unidad         varchar(20),
    CONSTRAINT preparacion_no_se_contiene CHECK (preparado_id <> componente_id)
);
CREATE INDEX IF NOT EXISTS ix_preparacion_preparado ON preparacion_componentes (preparado_id);

-- ---------------------------------------------------------------------------
-- Compras y transferencias
-- ---------------------------------------------------------------------------
-- Una compra agrupa las entradas de una misma nota del proveedor.
CREATE TABLE IF NOT EXISTS compras (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id  uuid          NOT NULL REFERENCES branches (id) ON DELETE CASCADE,
    proveedor  varchar(120),
    nota       varchar(300),
    total      numeric(12,2),
    usuario    varchar(100),
    creado_en  timestamp     NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_compras_sucursal ON compras (branch_id, creado_en DESC);

-- Los movimientos de una misma compra, transferencia o produccion comparten grupo.
ALTER TABLE movimientos_inventario ADD COLUMN IF NOT EXISTS grupo_id uuid;
CREATE INDEX IF NOT EXISTS ix_movimientos_grupo ON movimientos_inventario (grupo_id);

ALTER TABLE movimientos_inventario DROP CONSTRAINT IF EXISTS movimientos_tipo_valido;
ALTER TABLE movimientos_inventario ADD CONSTRAINT movimientos_tipo_valido
    CHECK (tipo IN ('VENTA', 'CANCELACION', 'ENTRADA', 'MERMA', 'CONTEO', 'AJUSTE', 'PRODUCCION', 'TRANSFERENCIA'));

-- ---------------------------------------------------------------------------
-- Permisos de inventario
-- ---------------------------------------------------------------------------
-- Aparte del catalogo: quien lleva el almacen no necesita tocar precios ni platillos.
INSERT INTO permissions (name, description) VALUES
    ('INVENTORY_READ',   'Ver existencias, historial y reportes de inventario.'),
    ('INVENTORY_UPDATE', 'Registrar compras, mermas, conteos, preparaciones y transferencias.')
ON CONFLICT (name) DO NOTHING;

-- Quien ya podia modificar el catalogo (y con el, el inventario) conserva ese alcance.
INSERT INTO role_permissions (role_id, permission_id)
SELECT DISTINCT rp.role_id, p.id
FROM role_permissions rp
JOIN permissions actual ON actual.id = rp.permission_id AND actual.name = 'CATALOG_UPDATE'
CROSS JOIN permissions p
WHERE p.name IN ('INVENTORY_READ', 'INVENTORY_UPDATE')
ON CONFLICT DO NOTHING;
