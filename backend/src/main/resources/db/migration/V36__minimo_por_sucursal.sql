-- Minimo por sucursal.
--
-- Cada sucursal vende distinto: la del centro necesita 10 kg de carne y la
-- chica con 3 le alcanza. El minimo del catalogo (ingredients.minimo,
-- products.minimo) queda como el general; aqui va el de cada sucursal.
-- Null = usar el general.
ALTER TABLE branch_ingredient_stocks ADD COLUMN IF NOT EXISTS minimo numeric(12,3);
ALTER TABLE branch_product_stocks ADD COLUMN IF NOT EXISTS minimo integer;
