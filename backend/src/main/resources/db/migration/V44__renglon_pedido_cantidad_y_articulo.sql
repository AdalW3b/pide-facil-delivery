-- El mensaje al proveedor separa la cantidad del articulo ("*10 kg* · Arrachera").
-- Los renglones de antes no los tienen: siguen saliendo con su descripcion.
ALTER TABLE pedido_proveedor_renglones ADD COLUMN IF NOT EXISTS cantidad_texto varchar(80);
ALTER TABLE pedido_proveedor_renglones ADD COLUMN IF NOT EXISTS articulo varchar(120);
