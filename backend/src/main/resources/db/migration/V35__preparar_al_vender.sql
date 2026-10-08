-- Preparaciones que se descuentan solas al vender.
--
-- Si la cocina no registra la salsa que hizo, la salsa queda en negativo y el
-- tomatillo nunca baja (y en modo "Bloquear" los platillos con salsa aparecen
-- agotados). Con esta opcion, cuando se vende mas salsa de la registrada, lo
-- que falta se prepara en ese momento: salen sus ingredientes y queda en el
-- historial como "Preparación automática".
ALTER TABLE ingredients ADD COLUMN IF NOT EXISTS preparar_al_vender boolean NOT NULL DEFAULT false;
