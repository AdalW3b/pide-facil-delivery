-- Roles: lo de la plataforma solo para el operador, y nombres por restaurante.
--
-- Corrige la auditoria del modulo de roles: un dueño o un rol personalizado
-- tenian MANAGE_RESTAURANTS (dar de alta restaurantes y sucursales ajenas), y
-- el nombre de un rol era unico en toda la plataforma.

-- 1. Los permisos con nombre de rol (SUPER_ADMIN, SYSTEM_ADMIN, BRANCH_MANAGER)
-- sobran: el nombre de un rol del sistema ya cuenta como permiso. Dejarlos
-- permitia ponerlos en un rol personalizado y volverse dueño u operador.
DELETE FROM permissions WHERE name IN ('SUPER_ADMIN', 'SYSTEM_ADMIN', 'BRANCH_MANAGER');

-- 2. MANAGE_RESTAURANTS es del operador de la plataforma y de nadie mas.
DELETE FROM role_permissions rp
USING roles r, permissions p
WHERE rp.role_id = r.id
  AND rp.permission_id = p.id
  AND p.name = 'MANAGE_RESTAURANTS'
  AND NOT (r.name = 'SYSTEM_ADMIN' AND r.restaurant_id IS NULL);

-- 3. Los permisos que el panel y los controladores ya piden y que una base
-- nueva no tenia (en produccion se dieron de alta a mano).
INSERT INTO permissions (name, description) VALUES
    ('BRANCH_UPDATE',  'Modificar los datos y la configuracion de la sucursal.'),
    ('WHATSAPP_READ',  'Ver el estado del WhatsApp de la sucursal.')
ON CONFLICT (name) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.name IN ('BRANCH_UPDATE', 'WHATSAPP_READ')
WHERE r.restaurant_id IS NULL AND r.name IN ('SUPER_ADMIN', 'BRANCH_MANAGER')
ON CONFLICT DO NOTHING;

-- 4. Un rol personalizado no puede llamarse como uno del sistema: el codigo
-- compara esos nombres sin distinguir mayusculas. Si alguno existe, se renombra.
UPDATE roles
SET name = left(name, 80) || ' (personalizado)'
WHERE restaurant_id IS NOT NULL
  AND upper(name) IN ('SYSTEM_ADMIN', 'SUPER_ADMIN', 'BRANCH_MANAGER', 'ADMIN', 'MESERO', 'COCINA');

-- 5. El nombre es unico por restaurante (y entre los del sistema), no en
-- toda la plataforma: dos restaurantes pueden tener su "Cajero".
ALTER TABLE roles DROP CONSTRAINT IF EXISTS roles_name_key;
CREATE UNIQUE INDEX IF NOT EXISTS ux_roles_nombre_por_restaurante
    ON roles (COALESCE(restaurant_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(name));

COMMENT ON COLUMN roles.name IS
    'Unico por restaurante (sin distinguir mayusculas); los del sistema, unicos entre si.';

-- 6. El rol del operador habla de la plataforma, no de un nombre anterior.
UPDATE roles
SET description = 'Operador de la plataforma: da de alta restaurantes y los administra.'
WHERE name = 'SYSTEM_ADMIN' AND restaurant_id IS NULL;
