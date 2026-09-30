-- Combos y paquetes de promocion: "Combo pareja" = 4 tacos + 2 refrescos por
-- $199. Un combo es un producto mas del menu (tiene categoria, precio, foto y
-- adicionales como cualquier platillo) que en vez de receta lleva platillos.
--
-- Al venderse, lo que gasta del inventario es lo de sus platillos: la receta
-- de cada taco y la existencia de cada refresco.

ALTER TABLE products ADD COLUMN IF NOT EXISTS is_combo boolean NOT NULL DEFAULT false;

-- Vigencia de la promocion. Todo es opcional: sin fechas ni dias, el combo se
-- vende siempre. promo_dias son los dias ISO separados por coma (1 = lunes,
-- 7 = domingo): "2,4" = martes y jueves.
ALTER TABLE products ADD COLUMN IF NOT EXISTS promo_desde date;
ALTER TABLE products ADD COLUMN IF NOT EXISTS promo_hasta date;
ALTER TABLE products ADD COLUMN IF NOT EXISTS promo_dias varchar(20);

ALTER TABLE products ADD CONSTRAINT products_promo_rango
    CHECK (promo_desde IS NULL OR promo_hasta IS NULL OR promo_desde <= promo_hasta);

CREATE TABLE IF NOT EXISTS combo_items (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    combo_id    uuid    NOT NULL REFERENCES products (id) ON DELETE CASCADE,
    -- RESTRICT: borrar un platillo que va en un combo dejaria el combo vendiendo
    -- algo que ya no existe. Primero se quita del combo.
    product_id  uuid    NOT NULL REFERENCES products (id) ON DELETE RESTRICT,
    cantidad    integer NOT NULL,
    orden       integer NOT NULL DEFAULT 0,

    CONSTRAINT combo_items_cantidad_valida CHECK (cantidad BETWEEN 1 AND 50),
    CONSTRAINT combo_items_no_se_contiene CHECK (combo_id <> product_id)
);

CREATE INDEX IF NOT EXISTS ix_combo_items_combo ON combo_items (combo_id);
CREATE INDEX IF NOT EXISTS ix_combo_items_producto ON combo_items (product_id);

-- Lo que llevaba el combo cuando se vendio, igual que se congela el precio y
-- los adicionales: cocina ve lo que se pidio y, si se cancela, se devuelve al
-- inventario exactamente eso aunque despues se cambie el combo.
CREATE TABLE IF NOT EXISTS order_item_componentes (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_item_id  uuid         NOT NULL REFERENCES order_items (id) ON DELETE CASCADE,
    -- Puede quedar null si despues se borra el platillo del catalogo.
    product_id     uuid         REFERENCES products (id) ON DELETE SET NULL,
    nombre         varchar(100) NOT NULL,
    -- Por cada combo de la linea: 2 combos con 4 tacos cada uno = cantidad 4.
    cantidad       integer      NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_order_item_componentes_item ON order_item_componentes (order_item_id);
