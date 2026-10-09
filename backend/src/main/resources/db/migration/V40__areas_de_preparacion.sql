-- Areas de preparacion: cada comanda se divide entre cocina, parrilla, barra
-- y postres, y empaque junta lo de domicilio y para llevar. Cada area tiene su
-- tablet o pantalla y avanza solo lo suyo.

CREATE TABLE IF NOT EXISTS areas_preparacion (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id   uuid         NOT NULL REFERENCES restaurants (id) ON DELETE CASCADE,
    nombre          varchar(40)  NOT NULL,
    -- PREPARACION (prepara platillos) o EMPAQUE (junta los pedidos para llevar).
    tipo            varchar(12)  NOT NULL DEFAULT 'PREPARACION',
    orden           integer      NOT NULL DEFAULT 0,
    activa          boolean      NOT NULL DEFAULT true,
    -- A donde va lo que no tiene area asignada.
    predeterminada  boolean      NOT NULL DEFAULT false,
    creado_en       timestamp    NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_areas_nombre ON areas_preparacion (restaurant_id, lower(nombre));

ALTER TABLE categories ADD COLUMN IF NOT EXISTS area_id uuid REFERENCES areas_preparacion (id) ON DELETE SET NULL;
-- Un platillo puede ir a otra area que su categoria (el cafe en "Postres").
ALTER TABLE products ADD COLUMN IF NOT EXISTS area_id uuid REFERENCES areas_preparacion (id) ON DELETE SET NULL;
-- Refrescos y agua embotellada: nacen listos, nadie los prepara.
ALTER TABLE products ADD COLUMN IF NOT EXISTS sin_preparacion boolean NOT NULL DEFAULT false;
-- El area con que se pidio: si despues cambia la configuracion, lo que ya esta
-- en preparacion no se mueve de pantalla.
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS area_id uuid REFERENCES areas_preparacion (id) ON DELETE SET NULL;

-- Las areas de siempre para cada restaurante.
INSERT INTO areas_preparacion (restaurant_id, nombre, tipo, orden, predeterminada)
SELECT r.id, v.nombre, v.tipo, v.orden, v.predeterminada
FROM restaurants r
CROSS JOIN (VALUES ('Cocina', 'PREPARACION', 1, true),
                   ('Parrilla', 'PREPARACION', 2, false),
                   ('Barra', 'PREPARACION', 3, false),
                   ('Postres', 'PREPARACION', 4, false),
                   ('Empaque', 'EMPAQUE', 5, false)) AS v (nombre, tipo, orden, predeterminada)
WHERE NOT EXISTS (SELECT 1 FROM areas_preparacion a WHERE a.restaurant_id = r.id);

-- Primera asignacion por el nombre de la categoria; lo demas queda en Cocina.
UPDATE categories c SET area_id = a.id
FROM areas_preparacion a
WHERE a.restaurant_id = c.restaurant_id AND a.nombre = 'Barra' AND c.area_id IS NULL
  AND (c.name ILIKE '%bebida%' OR c.name ILIKE '%refresco%' OR c.name ILIKE '%agua%' OR c.name ILIKE '%caf%'
       OR c.name ILIKE '%jugo%' OR c.name ILIKE '%licuado%' OR c.name ILIKE '%cerveza%' OR c.name ILIKE '%c_ctel%'
       OR c.name ILIKE '%drink%' OR c.name ILIKE '%malteada%');

UPDATE categories c SET area_id = a.id
FROM areas_preparacion a
WHERE a.restaurant_id = c.restaurant_id AND a.nombre = 'Postres' AND c.area_id IS NULL
  AND (c.name ILIKE '%postre%' OR c.name ILIKE '%dulce%' OR c.name ILIKE '%pastel%' OR c.name ILIKE '%helado%'
       OR c.name ILIKE '%nieve%' OR c.name ILIKE '%pay%');

UPDATE categories c SET area_id = a.id
FROM areas_preparacion a
WHERE a.restaurant_id = c.restaurant_id AND a.nombre = 'Parrilla' AND c.area_id IS NULL
  AND (c.name ILIKE '%parrilla%' OR c.name ILIKE '%asado%' OR c.name ILIKE '%corte%' OR c.name ILIKE '%grill%');

-- Refrescos y agua embotellada: sin preparacion.
UPDATE products p SET sin_preparacion = true
FROM categories c
WHERE c.id = p.category_id
  AND (c.name ILIKE '%refresco%'
       OR p.name ILIKE '%coca-cola%' OR p.name ILIKE '%coca cola%' OR p.name ILIKE '%cocacola%'
       OR p.name ILIKE '%refresco%' OR p.name ILIKE '%agua embotellada%' OR p.name ILIKE '%agua natural%'
       OR p.name ILIKE '%agua mineral%' OR p.name ILIKE '%topo chico%' OR p.name ILIKE '%pe_afiel%'
       OR p.name ILIKE '%sprite%' OR p.name ILIKE '%fanta%' OR p.name ILIKE '%pepsi%' OR p.name ILIKE '%squirt%'
       OR p.name ILIKE '%jarrito%' OR p.name ILIKE '%sidral%' OR p.name ILIKE '%manzanita%');
