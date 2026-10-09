-- El personal de cocina o barra trabaja en un area fija: entra directo a ella
-- y no ve las demas. Null = puede elegir (dueño, gerente o quien no tenga area).
ALTER TABLE users ADD COLUMN IF NOT EXISTS area_id uuid REFERENCES areas_preparacion (id) ON DELETE SET NULL;

-- El rol Cocina solo necesita su pantalla: ver y avanzar comandas, marcar
-- "se acabo" y empacar. Ver pedidos y catalogo le mostraba Domicilio,
-- Catalogo e Inventario en el menu sin necesitarlos.
DELETE FROM role_permissions rp
USING roles r, permissions p
WHERE rp.role_id = r.id AND rp.permission_id = p.id
  AND upper(r.name) = 'COCINA'
  AND p.name IN ('ORDERS_READ', 'CATALOG_READ');
