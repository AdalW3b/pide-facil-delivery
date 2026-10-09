-- El pedido al proveedor sale por el WhatsApp de la sucursal, como los avisos
-- al repartidor: queda anotado cuando y a que numero se mando.
ALTER TABLE pedidos_proveedor ADD COLUMN IF NOT EXISTS enviado_en timestamp;
ALTER TABLE pedidos_proveedor ADD COLUMN IF NOT EXISTS enviado_a varchar(30);
