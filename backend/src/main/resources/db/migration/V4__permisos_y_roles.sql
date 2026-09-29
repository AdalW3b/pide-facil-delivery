-- ============================================================================
--  Catálogo de permisos y roles del sistema
--
--  Los 24 permisos son los que el código exige de verdad: salen de los
--  @PreAuthorize("hasAuthority(...)") de los controladores y de los
--  requestMatchers de SecurityConfig. No están inventados y no sobra ninguno.
--  Si falta uno, el endpoint que lo pide devuelve 403 a todo el mundo.
--
--  El reparto de permisos por rol de más abajo SÍ es una propuesta y conviene
--  que la revises: es la decisión de quién puede tocar qué, y eso es negocio,
--  no esquema. Los cinco roles llevan is_custom = false y restaurant_id NULL,
--  o sea que son del sistema y los comparten todos los inquilinos.
-- ============================================================================

INSERT INTO permissions (name, description) VALUES
    ('MANAGE_RESTAURANTS', 'Crear y administrar restaurantes y sus sucursales. Permiso del operador de la plataforma.'),
    ('SYSTEM_ADMIN',       'Acceso de administración de la plataforma.'),
    ('SUPER_ADMIN',        'Administración total del propio restaurante.'),
    ('BRANCH_MANAGER',     'Gestión de una sucursal.'),
    ('BRANCH_READ',        'Ver los datos de la sucursal.'),
    ('CATALOG_READ',       'Ver categorías, platos, ingredientes y recetas.'),
    ('CATALOG_CREATE',     'Crear elementos del catálogo.'),
    ('CATALOG_UPDATE',     'Modificar el catálogo y los precios.'),
    ('CATALOG_DELETE',     'Eliminar elementos del catálogo.'),
    ('ORDERS_READ',        'Ver pedidos y cuentas.'),
    ('ORDERS_CREATE',      'Abrir pedidos y añadir productos.'),
    ('ORDERS_UPDATE',      'Modificar y cerrar pedidos.'),
    ('ORDERS_DELETE',      'Anular pedidos.'),
    ('TABLES_READ',        'Ver el salón y el estado de las mesas.'),
    ('TABLES_CREATE',      'Crear mesas y generar sus QR.'),
    ('TABLES_UPDATE',      'Cambiar el estado de una mesa y su asignación.'),
    ('TABLES_DELETE',      'Eliminar mesas.'),
    ('KITCHEN_READ',       'Ver la pantalla de cocina.'),
    ('KITCHEN_UPDATE',     'Cambiar el estado de preparación de una comanda.'),
    ('USERS_READ',         'Ver el personal.'),
    ('USERS_CREATE',       'Dar de alta empleados.'),
    ('USERS_UPDATE',       'Modificar empleados y sus roles.'),
    ('USERS_DELETE',       'Dar de baja empleados.'),
    ('WHATSAPP_UPDATE',    'Vincular y desvincular el número de WhatsApp de la sucursal.');

INSERT INTO roles (name, description, default_route, is_custom, restaurant_id) VALUES
    ('SYSTEM_ADMIN',   'Operador de la plataforma. Da de alta restaurantes.', '/admin',     false, NULL),
    ('SUPER_ADMIN',    'Dueño del restaurante. Control total de su cuenta.',  '/dashboard', false, NULL),
    ('BRANCH_MANAGER', 'Encargado de una sucursal.',                          '/dashboard', false, NULL),
    ('MESERO',         'Atiende el salón y toma pedidos.',                     '/dashboard', false, NULL),
    ('COCINA',         'Solo ve y despacha comandas.',                         '/kitchen',   false, NULL);

-- Reparto rol → permiso. Cada par se resuelve por nombre, así que el orden de
-- los INSERT anteriores no importa y añadir un par nuevo es una línea más.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM (VALUES
    -- operador de la plataforma: todo, incluido el alta de restaurantes
    ('SYSTEM_ADMIN',   'MANAGE_RESTAURANTS'),
    ('SYSTEM_ADMIN',   'SYSTEM_ADMIN'),
    ('SYSTEM_ADMIN',   'BRANCH_READ'),
    ('SYSTEM_ADMIN',   'CATALOG_READ'),
    ('SYSTEM_ADMIN',   'ORDERS_READ'),
    ('SYSTEM_ADMIN',   'TABLES_READ'),
    ('SYSTEM_ADMIN',   'KITCHEN_READ'),
    ('SYSTEM_ADMIN',   'USERS_READ'),

    -- dueño del restaurante: todo lo suyo, nada de la plataforma
    ('SUPER_ADMIN',    'SUPER_ADMIN'),
    ('SUPER_ADMIN',    'BRANCH_READ'),
    ('SUPER_ADMIN',    'CATALOG_READ'),
    ('SUPER_ADMIN',    'CATALOG_CREATE'),
    ('SUPER_ADMIN',    'CATALOG_UPDATE'),
    ('SUPER_ADMIN',    'CATALOG_DELETE'),
    ('SUPER_ADMIN',    'ORDERS_READ'),
    ('SUPER_ADMIN',    'ORDERS_CREATE'),
    ('SUPER_ADMIN',    'ORDERS_UPDATE'),
    ('SUPER_ADMIN',    'ORDERS_DELETE'),
    ('SUPER_ADMIN',    'TABLES_READ'),
    ('SUPER_ADMIN',    'TABLES_CREATE'),
    ('SUPER_ADMIN',    'TABLES_UPDATE'),
    ('SUPER_ADMIN',    'TABLES_DELETE'),
    ('SUPER_ADMIN',    'KITCHEN_READ'),
    ('SUPER_ADMIN',    'KITCHEN_UPDATE'),
    ('SUPER_ADMIN',    'USERS_READ'),
    ('SUPER_ADMIN',    'USERS_CREATE'),
    ('SUPER_ADMIN',    'USERS_UPDATE'),
    ('SUPER_ADMIN',    'USERS_DELETE'),
    ('SUPER_ADMIN',    'WHATSAPP_UPDATE'),

    -- encargado: opera la sucursal y da de alta personal, pero no lo despide
    ('BRANCH_MANAGER', 'BRANCH_MANAGER'),
    ('BRANCH_MANAGER', 'BRANCH_READ'),
    ('BRANCH_MANAGER', 'CATALOG_READ'),
    ('BRANCH_MANAGER', 'CATALOG_CREATE'),
    ('BRANCH_MANAGER', 'CATALOG_UPDATE'),
    ('BRANCH_MANAGER', 'ORDERS_READ'),
    ('BRANCH_MANAGER', 'ORDERS_CREATE'),
    ('BRANCH_MANAGER', 'ORDERS_UPDATE'),
    ('BRANCH_MANAGER', 'ORDERS_DELETE'),
    ('BRANCH_MANAGER', 'TABLES_READ'),
    ('BRANCH_MANAGER', 'TABLES_CREATE'),
    ('BRANCH_MANAGER', 'TABLES_UPDATE'),
    ('BRANCH_MANAGER', 'KITCHEN_READ'),
    ('BRANCH_MANAGER', 'KITCHEN_UPDATE'),
    ('BRANCH_MANAGER', 'USERS_READ'),
    ('BRANCH_MANAGER', 'USERS_CREATE'),
    ('BRANCH_MANAGER', 'USERS_UPDATE'),
    ('BRANCH_MANAGER', 'WHATSAPP_UPDATE'),

    -- mesero: el salón y nada más
    ('MESERO',         'BRANCH_READ'),
    ('MESERO',         'CATALOG_READ'),
    ('MESERO',         'ORDERS_READ'),
    ('MESERO',         'ORDERS_CREATE'),
    ('MESERO',         'ORDERS_UPDATE'),
    ('MESERO',         'TABLES_READ'),
    ('MESERO',         'TABLES_UPDATE'),

    -- cocina: ve la comanda y la despacha. No ve precios ni ventas.
    ('COCINA',         'KITCHEN_READ'),
    ('COCINA',         'KITCHEN_UPDATE'),
    ('COCINA',         'ORDERS_READ'),
    ('COCINA',         'CATALOG_READ')
) AS asignacion (rol, permiso)
JOIN roles       r ON r.name = asignacion.rol
JOIN permissions p ON p.name = asignacion.permiso;


-- ============================================================================
--  Usuario inicial
--
--  Va comentado a propósito: un hash de contraseña conocido dentro de una
--  migración es una puerta abierta, y las migraciones acaban en el repositorio.
--
--  Genera el hash BCrypt aparte y pégalo aquí, o mejor, crea este usuario
--  desde el endpoint de registro con la aplicación ya levantada. Para generar
--  el hash a mano:
--
--    mvn -q compile exec:java \
--      -Dexec.mainClass=org.springframework.security.crypto.bcrypt.BCrypt
--
--  o cualquier herramienta que produzca un BCrypt de coste 10.
-- ============================================================================

-- INSERT INTO restaurants (name) VALUES ('Nombre del restaurante');
--
-- INSERT INTO users (restaurant_id, role_id, username, name, password_hash)
-- SELECT
--     (SELECT id FROM restaurants WHERE name = 'Nombre del restaurante'),
--     (SELECT id FROM roles WHERE name = 'SUPER_ADMIN'),
--     'admin',
--     'Administrador',
--     '$2a$10$PEGA_AQUI_TU_HASH_BCRYPT_DE_60_CARACTERES';
