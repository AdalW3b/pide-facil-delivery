-- Cambios aplicados a mano el 24/09/2026, ahora versionados para que una base
-- nueva quede igual que la que ya esta en uso.
--
-- Las dos instrucciones son idempotentes a proposito: en heychef-db ya existen
-- y no deben fallar, y en una base limpia se crean.

-- 1. El monitor de cocina permite cancelar un platillo, pero el tipo no aceptaba
--    ese valor y la operacion moria en la base.
ALTER TYPE kitchen_status ADD VALUE IF NOT EXISTS 'CANCELLED';

-- 2. Etapa de cocina mas avanzada ya avisada al comensal por WhatsApp. Evita
--    repetirle el mismo mensaje cuando se agregan platillos a un pedido en curso.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS kitchen_notified varchar(20);
