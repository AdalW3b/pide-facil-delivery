-- Cuando el mesero le mando la cuenta al cliente por WhatsApp desde el panel.
-- Sirve para que otro mesero vea que ya se envio y no la mande dos veces.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cuenta_enviada_en timestamp;
