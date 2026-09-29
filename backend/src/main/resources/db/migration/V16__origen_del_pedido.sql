-- Por donde entro el pedido: menu web, telefono, bot de WhatsApp o salon.
--
-- El tipo (domicilio, para llevar, salon) dice como sale el pedido; el origen
-- dice por donde entro. Un domicilio puede llegar por el menu web o por una
-- llamada, y las analiticas por canal necesitan distinguirlos.
-- Null en los pedidos anteriores: no se sabe con certeza por donde entraron.

ALTER TABLE orders ADD COLUMN IF NOT EXISTS origen varchar(15);

ALTER TABLE orders ADD CONSTRAINT orders_origen_valido
    CHECK (origen IS NULL OR origen IN ('WEB', 'TELEFONO', 'WHATSAPP', 'SALON'));
