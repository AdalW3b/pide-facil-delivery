-- ============================================================================
--  Esquema inicial · 17 tablas + 2 tablas intermedias
--  Derivado de las 20 clases @Entity de omnirest-backend.
--
--  Requiere PostgreSQL 13 o superior (gen_random_uuid() viene en el núcleo).
--  En PostgreSQL 12 o anterior, descomenta la extensión de abajo.
--
--  Criterio de nulabilidad: una columna es NOT NULL solo cuando la entidad
--  Java lo declara (nullable = false) o es clave primaria o foránea obligatoria.
--  El resto queda nullable con DEFAULT, porque Lombok @Builder.Default NO
--  inicializa el campo cuando se usa el constructor sin argumentos: un
--  new Product() manda null, y un NOT NULL de más rompería el guardado.
--  Los ajustes que sí conviene endurecer están al final del README.
-- ============================================================================

-- CREATE EXTENSION IF NOT EXISTS pgcrypto;  -- solo en PostgreSQL <= 12

-- ---------------------------------------------------------------- inquilinos
CREATE TABLE restaurants (
    id          uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
    name        varchar(100) NOT NULL,
    active      boolean      DEFAULT true,
    created_at  timestamp    NOT NULL DEFAULT now()
);

COMMENT ON TABLE restaurants IS 'Inquilino raíz. Cada restaurante es un cliente del sistema.';

-- --------------------------------------------------------------- autorización
CREATE TABLE permissions (
    id           uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
    name         varchar(100) NOT NULL UNIQUE,
    description  varchar(255)
);

COMMENT ON TABLE permissions IS
    'Catálogo de autoridades. El nombre viaja tal cual al token y lo evalúa '
    '@PreAuthorize("hasAuthority(...)"). No lleva prefijo ROLE_: el código no usa hasRole.';

CREATE TABLE roles (
    id             uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
    name           varchar(100) NOT NULL UNIQUE,
    description    varchar(255),
    default_route  varchar(255),
    is_custom      boolean      NOT NULL DEFAULT true,
    restaurant_id  uuid         REFERENCES restaurants (id) ON DELETE CASCADE
);

COMMENT ON COLUMN roles.name IS
    'OJO: único a nivel global, no por restaurante. Dos inquilinos no pueden '
    'tener ambos un rol llamado "Mesero". Ver la nota de multi-inquilino en el README.';
COMMENT ON COLUMN roles.default_route IS 'Ruta del frontend a la que se envía al usuario tras entrar.';
COMMENT ON COLUMN roles.restaurant_id IS 'NULL en los roles del sistema; con valor en los roles que crea un inquilino.';

CREATE TABLE role_permissions (
    role_id        uuid NOT NULL REFERENCES roles (id)       ON DELETE CASCADE,
    permission_id  uuid NOT NULL REFERENCES permissions (id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

-- ------------------------------------------------------------------- sucursal
CREATE TABLE branches (
    id               uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id    uuid         NOT NULL REFERENCES restaurants (id) ON DELETE CASCADE,
    name             varchar(100) NOT NULL,
    address          text,
    whatsapp_number  varchar(20)  UNIQUE,
    n8n_webhook_url  varchar(255),
    webhook_secret   varchar(255),
    active           boolean      DEFAULT true,
    created_at       timestamp    NOT NULL DEFAULT now()
);

COMMENT ON COLUMN branches.whatsapp_number IS 'Único en todo el sistema: un número de WhatsApp pertenece a una sola sucursal.';
COMMENT ON COLUMN branches.webhook_secret IS 'Secreto compartido con n8n para firmar la entrada del webhook. Trátalo como credencial.';

-- -------------------------------------------------------------------- usuarios
CREATE TABLE users (
    id             uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id  uuid         NOT NULL REFERENCES restaurants (id) ON DELETE CASCADE,
    branch_id      uuid         REFERENCES branches (id) ON DELETE SET NULL,
    role_id        uuid         NOT NULL REFERENCES roles (id),
    username       varchar(50)  NOT NULL UNIQUE,
    name           varchar(100),
    phone_number   varchar(20),
    password_hash  varchar(255) NOT NULL,
    active         boolean      DEFAULT true,
    created_at     timestamp    NOT NULL DEFAULT now()
);

COMMENT ON COLUMN users.username IS
    'OJO: único a nivel global. Dos restaurantes no pueden tener ambos un usuario "admin". '
    'Ver la nota de multi-inquilino en el README.';
COMMENT ON COLUMN users.branch_id IS 'NULL cuando el usuario es de alcance restaurante y no de una sede concreta.';

-- ----------------------------------------------------------------------- salón
CREATE TABLE tables (
    id            uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id     uuid         NOT NULL REFERENCES branches (id) ON DELETE CASCADE,
    table_number  integer      NOT NULL,
    qr_token      varchar(255) UNIQUE,
    status        varchar(20)  DEFAULT 'AVAILABLE'
                  CONSTRAINT tables_status_check
                  CHECK (status IN ('AVAILABLE', 'OCCUPIED', 'RESERVED'))
);

COMMENT ON COLUMN tables.qr_token IS 'Token del QR de la mesa. GET /api/v1/qr/{token} redirige al WhatsApp de la sucursal.';

CREATE TABLE user_tables (
    user_id   uuid NOT NULL REFERENCES users (id)  ON DELETE CASCADE,
    table_id  uuid NOT NULL REFERENCES tables (id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, table_id)
);

COMMENT ON TABLE user_tables IS 'Mesas asignadas a cada mesero. Es la @ManyToMany entre users y tables.';

-- -------------------------------------------------------------------- comensal
CREATE TABLE customers (
    id             uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id  uuid         NOT NULL REFERENCES restaurants (id) ON DELETE CASCADE,
    phone_number   varchar(255) NOT NULL,
    name           varchar(255) NOT NULL,
    total_visits   integer      DEFAULT 1,
    last_visit     timestamp,
    created_at     timestamp    NOT NULL DEFAULT now()
);

COMMENT ON TABLE customers IS 'Ficha del comensal, identificada por su teléfono de WhatsApp. Semilla del CRM.';

-- -------------------------------------------------------------------- catálogo
CREATE TABLE categories (
    id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id  uuid        NOT NULL REFERENCES restaurants (id) ON DELETE CASCADE,
    name           varchar(50) NOT NULL,
    active         boolean     DEFAULT true
);

CREATE TABLE products (
    id           uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id  uuid          NOT NULL REFERENCES categories (id) ON DELETE CASCADE,
    name         varchar(100)  NOT NULL,
    price        numeric(10,2) NOT NULL,
    description  text,
    active       boolean       DEFAULT true,
    track_stock  boolean       DEFAULT false,
    is_recipe    boolean       DEFAULT false
);

COMMENT ON COLUMN products.track_stock IS 'true = se controla como unidades en branch_product_stocks.';
COMMENT ON COLUMN products.is_recipe  IS 'true = se descuenta por ingredientes vía recipe_items.';

CREATE TABLE ingredients (
    id               uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id    uuid         NOT NULL REFERENCES restaurants (id) ON DELETE CASCADE,
    name             varchar(100) NOT NULL,
    unit_of_measure  varchar(50),
    active           boolean      DEFAULT true
);

CREATE TABLE recipe_items (
    id             uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id     uuid          NOT NULL REFERENCES products (id)    ON DELETE CASCADE,
    ingredient_id  uuid          NOT NULL REFERENCES ingredients (id) ON DELETE CASCADE,
    quantity       numeric(10,3) NOT NULL,
    recipe_unit    varchar(50)
);

COMMENT ON TABLE recipe_items IS 'Receta: cuánto de cada ingrediente consume un plato al venderse.';

-- ---------------------------------------------------------- existencias por sede
CREATE TABLE branch_ingredient_stocks (
    branch_id      uuid          NOT NULL REFERENCES branches (id)    ON DELETE CASCADE,
    ingredient_id  uuid          NOT NULL REFERENCES ingredients (id) ON DELETE CASCADE,
    stock          numeric(10,3) NOT NULL DEFAULT 0,
    PRIMARY KEY (branch_id, ingredient_id)
);

CREATE TABLE branch_product_stocks (
    branch_id   uuid    NOT NULL REFERENCES branches (id) ON DELETE CASCADE,
    product_id  uuid    NOT NULL REFERENCES products (id) ON DELETE CASCADE,
    stock       integer NOT NULL DEFAULT 0,
    PRIMARY KEY (branch_id, product_id)
);

COMMENT ON TABLE branch_ingredient_stocks IS 'El stock es por sucursal, no por restaurante.';

-- --------------------------------------------------------------- medios de pago
CREATE TABLE payment_methods (
    id            uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id     uuid         NOT NULL REFERENCES branches (id) ON DELETE CASCADE,
    name          varchar(100) NOT NULL,
    instructions  text,
    active        boolean      NOT NULL DEFAULT true
);

-- ---------------------------------------------------------------------- pedidos
CREATE TABLE orders (
    id            uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id     uuid          NOT NULL REFERENCES branches (id) ON DELETE CASCADE,
    table_id      uuid          NOT NULL REFERENCES tables (id),
    customer_id   uuid          REFERENCES customers (id) ON DELETE SET NULL,
    status        varchar(20)   DEFAULT 'OPEN'
                  CONSTRAINT orders_status_check
                  CHECK (status IN ('OPEN', 'CLOSED', 'CANCELLED')),
    total_amount  numeric(10,2) DEFAULT 0,
    created_at    timestamp     NOT NULL DEFAULT now(),
    closed_at     timestamp
);

COMMENT ON COLUMN orders.table_id IS
    'Obligatorio en la entidad. Los pedidos que entran por WhatsApp sin mesa física '
    'necesitan una mesa de servicio creada para eso.';
COMMENT ON COLUMN orders.closed_at IS
    'Se rellena al cerrar la cuenta. Toda la analítica de ventas se apoya en esta fecha, no en created_at.';

CREATE TABLE order_items (
    id                    uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id              uuid          NOT NULL REFERENCES orders (id)   ON DELETE CASCADE,
    product_id            uuid          NOT NULL REFERENCES products (id),
    quantity              integer       NOT NULL,
    unit_price            numeric(10,2) NOT NULL,
    special_instructions  text,
    kitchen_status        varchar(20)   NOT NULL DEFAULT 'PENDING'
                          CONSTRAINT order_items_kitchen_status_check
                          CHECK (kitchen_status IN ('PENDING', 'PREPARING', 'READY', 'DELIVERED', 'CANCELLED')),
    ready_at              timestamp
);

COMMENT ON COLUMN order_items.unit_price IS
    'Precio congelado en el momento de la venta. No se lee de products.price, '
    'para que un cambio de precio no reescriba el histórico.';
