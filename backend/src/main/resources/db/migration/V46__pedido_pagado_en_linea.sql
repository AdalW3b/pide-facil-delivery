-- Pedido del menu en linea pagado con tarjeta (Stripe). Mientras Stripe no
-- confirma el pago no lo ve nadie: ni el mostrador ni la cocina. Si no se paga
-- en 20 minutos se cancela solo.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS esperando_pago_linea boolean NOT NULL DEFAULT false;
-- Ya pagado con tarjeta: el repartidor no cobra y la caja no lo cuenta.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS pagado_en_linea boolean NOT NULL DEFAULT false;
