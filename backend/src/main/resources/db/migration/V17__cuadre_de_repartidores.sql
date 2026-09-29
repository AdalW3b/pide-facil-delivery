-- Cuadre de efectivo de los repartidores.
--
-- El repartidor cobra la comida y el envio en la puerta; la propina es suya.
-- Al cerrar el turno entrega en caja lo cobrado menos lo que se le paga por sus
-- entregas. Cada corte queda registrado con lo que se esperaba, lo que entrego
-- de verdad y la diferencia, y las entregas que liquida quedan marcadas para
-- que no se cuenten dos veces en el siguiente.

CREATE TABLE IF NOT EXISTS cortes_repartidor (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id        uuid          NOT NULL REFERENCES branches (id) ON DELETE CASCADE,
    driver_id        uuid          NOT NULL REFERENCES drivers (id),
    -- Quien lo recibio en caja.
    recibido_por     uuid          REFERENCES users (id) ON DELETE SET NULL,
    creado_en        timestamp     NOT NULL,
    entregas         integer       NOT NULL,
    -- Comida y envio cobrados en la puerta (sin propina).
    cobrado          numeric(10,2) NOT NULL,
    -- Lo que se le paga por esas entregas.
    pago_repartidor  numeric(10,2) NOT NULL,
    -- true: su pago sale del mismo efectivo y entrega cobrado - pago.
    -- false: se le paga aparte y entrega todo lo cobrado.
    pago_descontado  boolean       NOT NULL,
    esperado         numeric(10,2) NOT NULL,
    recibido         numeric(10,2) NOT NULL,
    -- recibido - esperado: negativo es faltante, positivo sobrante.
    diferencia       numeric(10,2) NOT NULL,
    notas            varchar(300)
);

CREATE INDEX IF NOT EXISTS ix_cortes_sucursal ON cortes_repartidor (branch_id, creado_en DESC);

ALTER TABLE orders ADD COLUMN IF NOT EXISTS corte_id uuid REFERENCES cortes_repartidor (id) ON DELETE SET NULL;

-- Las entregas por liquidar de un repartidor: entregadas y sin corte.
CREATE INDEX IF NOT EXISTS ix_orders_por_liquidar
    ON orders (branch_id, driver_id) WHERE corte_id IS NULL AND driver_id IS NOT NULL;
