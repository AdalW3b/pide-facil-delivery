-- La personalidad del asistente de WhatsApp se edita desde el panel y se
-- describe con frases ("amable, usa emojis, trata de usted..."): 255
-- caracteres se quedaban cortos.
ALTER TABLE branches ALTER COLUMN bot_tone TYPE varchar(600);
