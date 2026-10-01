-- Zonas de inventario dadas de alta: se escriben una vez y despues solo se
-- eligen de una lista. Escritas a mano salian "Refri", "refri" y "almacen"
-- como si fueran lugares distintos, y el conteo por zona se partia.

CREATE TABLE IF NOT EXISTS zonas_inventario (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id  uuid         NOT NULL REFERENCES restaurants (id) ON DELETE CASCADE,
    nombre         varchar(40)  NOT NULL,
    orden          integer      NOT NULL DEFAULT 0,
    creado_en      timestamp    NOT NULL DEFAULT now()
);
-- Una zona por nombre en cada restaurante, sin importar mayusculas.
CREATE UNIQUE INDEX IF NOT EXISTS ux_zonas_nombre ON zonas_inventario (restaurant_id, lower(nombre));

-- Las zonas que ya se habian escrito pasan a ser zonas dadas de alta: una por
-- nombre, sin distinguir mayusculas ni espacios, con la primera letra en mayuscula.
INSERT INTO zonas_inventario (restaurant_id, nombre)
SELECT restaurant_id, initcap(min(trim(zona)))
FROM (
    SELECT i.restaurant_id, i.zona FROM ingredients i WHERE i.zona IS NOT NULL AND trim(i.zona) <> ''
    UNION ALL
    SELECT c.restaurant_id, p.zona FROM products p JOIN categories c ON c.id = p.category_id
    WHERE p.zona IS NOT NULL AND trim(p.zona) <> ''
) z
GROUP BY restaurant_id, lower(trim(zona))
ON CONFLICT DO NOTHING;

ALTER TABLE ingredients ADD COLUMN IF NOT EXISTS zona_id uuid REFERENCES zonas_inventario (id) ON DELETE SET NULL;
ALTER TABLE products ADD COLUMN IF NOT EXISTS zona_id uuid REFERENCES zonas_inventario (id) ON DELETE SET NULL;

UPDATE ingredients i SET zona_id = z.id
FROM zonas_inventario z
WHERE z.restaurant_id = i.restaurant_id AND lower(z.nombre) = lower(trim(i.zona));

UPDATE products p SET zona_id = z.id
FROM categories c, zonas_inventario z
WHERE c.id = p.category_id AND z.restaurant_id = c.restaurant_id AND lower(z.nombre) = lower(trim(p.zona));

ALTER TABLE ingredients DROP COLUMN IF EXISTS zona;
ALTER TABLE products DROP COLUMN IF EXISTS zona;
