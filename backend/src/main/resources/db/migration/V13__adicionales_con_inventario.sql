-- Un adicional puede gastar inventario: "Carne extra" saca 80 g de pastor,
-- "Queso gratinado" 40 g de queso. Es opcional; "Sin cebolla" no gasta nada.
--
-- La cantidad va en la misma unidad en que se lleva el ingrediente, para no
-- tener que convertir: si el pastor se lleva en kg, 80 g se escriben 0.08.

ALTER TABLE adicionales ADD COLUMN IF NOT EXISTS ingredient_id uuid
    REFERENCES ingredients (id) ON DELETE SET NULL;
ALTER TABLE adicionales ADD COLUMN IF NOT EXISTS cantidad_ingrediente numeric(10,3);

ALTER TABLE adicionales ADD CONSTRAINT adicionales_cantidad_valida
    CHECK (cantidad_ingrediente IS NULL OR cantidad_ingrediente > 0);

-- Lo que se desconto en la venta, por unidad del platillo. Se congela igual que
-- el precio: si se cancela, se devuelve exactamente eso, aunque el catalogo
-- haya cambiado entre tanto.
ALTER TABLE order_item_adicionales ADD COLUMN IF NOT EXISTS ingredient_id uuid;
ALTER TABLE order_item_adicionales ADD COLUMN IF NOT EXISTS cantidad_ingrediente numeric(10,3);
