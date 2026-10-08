-- Costo promedio por sucursal.
--
-- Antes el costo era uno por restaurante, pero se promediaba con las
-- existencias de la sucursal que compraba: si una sucursal sin carne compraba
-- a $150, la carne de todas las demas pasaba a costar $150. Ahora cada
-- sucursal lleva el suyo (lo que pago ella, lo que le llego por traspaso) y
-- el de ingredients/products queda como el promedio de todo el restaurante.
--
-- Arranca con el costo que ya se tenia, para que ningun margen cambie hoy.

ALTER TABLE branch_ingredient_stocks ADD COLUMN IF NOT EXISTS costo_promedio numeric(12,4);
ALTER TABLE branch_product_stocks ADD COLUMN IF NOT EXISTS costo_promedio numeric(12,4);

UPDATE branch_ingredient_stocks s
SET costo_promedio = i.costo_promedio
FROM ingredients i
WHERE i.id = s.ingredient_id AND s.costo_promedio IS NULL AND i.costo_promedio IS NOT NULL;

UPDATE branch_product_stocks s
SET costo_promedio = p.costo_promedio
FROM products p
WHERE p.id = s.product_id AND s.costo_promedio IS NULL AND p.costo_promedio IS NOT NULL;
