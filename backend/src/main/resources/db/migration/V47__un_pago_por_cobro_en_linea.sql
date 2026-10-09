-- Un cobro en linea se registra como pago una sola vez. El aviso de Stripe y
-- la consulta del cliente podian llegar al mismo tiempo y registrarlo doble.
DELETE FROM pagos a USING pagos b
WHERE a.transaccion_linea_id IS NOT NULL
  AND a.transaccion_linea_id = b.transaccion_linea_id
  AND a.ctid > b.ctid;

CREATE UNIQUE INDEX IF NOT EXISTS ux_pagos_transaccion_linea
    ON pagos (transaccion_linea_id) WHERE transaccion_linea_id IS NOT NULL;
