-- Adicionales por platillo: carne extra, queso gratinado, "sin cebolla",
-- "tortilla de maiz o de harina".
--
-- El restaurante define GRUPOS una sola vez y los asigna a una categoria entera
-- (todos los tacos) o a platillos sueltos. Con minimo y maximo el mismo grupo
-- sirve para extras opcionales (0 a 5) y para elecciones obligatorias (1 y 1).

CREATE TABLE IF NOT EXISTS grupos_adicionales (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id  uuid         NOT NULL REFERENCES restaurants (id) ON DELETE CASCADE,
    nombre         varchar(60)  NOT NULL,
    -- Cuantos hay que elegir como minimo. 0 = opcional.
    minimo         integer      NOT NULL DEFAULT 0,
    -- Cuantos se pueden elegir como maximo, contando opciones distintas.
    maximo         integer      NOT NULL DEFAULT 1,
    orden          integer      NOT NULL DEFAULT 0,
    activo         boolean      NOT NULL DEFAULT true,
    creado_en      timestamp    NOT NULL DEFAULT now(),

    CONSTRAINT grupos_adicionales_rango CHECK (minimo >= 0 AND maximo >= 1 AND minimo <= maximo)
);

CREATE INDEX IF NOT EXISTS ix_grupos_adicionales_restaurante ON grupos_adicionales (restaurant_id);

CREATE TABLE IF NOT EXISTS adicionales (
    id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    grupo_id  uuid          NOT NULL REFERENCES grupos_adicionales (id) ON DELETE CASCADE,
    nombre    varchar(60)   NOT NULL,
    -- 0 para opciones sin costo, como "sin cebolla".
    precio    numeric(10,2) NOT NULL DEFAULT 0,
    orden     integer       NOT NULL DEFAULT 0,
    -- false = agotado hoy: se ve en la ficha pero no se puede elegir.
    activo    boolean       NOT NULL DEFAULT true,

    CONSTRAINT adicionales_precio_valido CHECK (precio >= 0)
);

CREATE INDEX IF NOT EXISTS ix_adicionales_grupo ON adicionales (grupo_id);

-- A que platillos aplica cada grupo. Un platillo recibe los grupos de su
-- categoria mas los que tenga asignados el mismo.
CREATE TABLE IF NOT EXISTS grupo_adicional_categorias (
    grupo_id     uuid NOT NULL REFERENCES grupos_adicionales (id) ON DELETE CASCADE,
    category_id  uuid NOT NULL REFERENCES categories (id) ON DELETE CASCADE,
    PRIMARY KEY (grupo_id, category_id)
);

CREATE TABLE IF NOT EXISTS grupo_adicional_productos (
    grupo_id    uuid NOT NULL REFERENCES grupos_adicionales (id) ON DELETE CASCADE,
    product_id  uuid NOT NULL REFERENCES products (id) ON DELETE CASCADE,
    PRIMARY KEY (grupo_id, product_id)
);

-- ---------------------------------------------------------------------------
-- Lo que se eligio en cada linea del pedido
-- ---------------------------------------------------------------------------
-- Se congela nombre y precio, igual que order_items.unit_price congela el del
-- platillo: si manana el queso sube de precio, los pedidos de ayer no cambian.
-- El adicional puede borrarse despues; la linea conserva lo que se cobro.
--
-- order_items.unit_price YA incluye los adicionales. Asi la cuenta, que en
-- varios lugares se recalcula como cantidad x precio unitario, sigue cuadrando
-- sin tocar ninguno de ellos. Esta tabla es el desglose, no el cobro.
CREATE TABLE IF NOT EXISTS order_item_adicionales (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_item_id  uuid          NOT NULL REFERENCES order_items (id) ON DELETE CASCADE,
    adicional_id   uuid          REFERENCES adicionales (id) ON DELETE SET NULL,
    grupo_nombre   varchar(60)   NOT NULL,
    nombre         varchar(60)   NOT NULL,
    precio         numeric(10,2) NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_order_item_adicionales_item ON order_item_adicionales (order_item_id);

COMMENT ON TABLE order_item_adicionales IS
    'Desglose congelado de los adicionales de cada linea. El cobro ya va en order_items.unit_price.';
