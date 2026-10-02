-- Caja: turnos con fondo inicial, cobro de cada cuenta y arqueo al cierre.
--
-- Una caja por sucursal: se abre con un fondo, ahi caen los cobros en
-- efectivo, los retiros y los cortes de los repartidores, y se cierra
-- contando el efectivo a ciegas contra lo que deberia haber.

-- Que metodo de pago es efectivo: es lo unico que entra al cajon y lo unico
-- que se cuenta en el arqueo. Los que ya existen se marcan por su nombre.
ALTER TABLE payment_methods ADD COLUMN IF NOT EXISTS es_efectivo boolean NOT NULL DEFAULT false;
UPDATE payment_methods SET es_efectivo = true WHERE name ILIKE '%efectivo%';

CREATE TABLE IF NOT EXISTS turnos_caja (
    id                  uuid           PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id           uuid           NOT NULL REFERENCES branches (id) ON DELETE CASCADE,
    abierto_por         uuid           REFERENCES users (id) ON DELETE SET NULL,
    abierto_por_nombre  varchar(120),
    abierto_en          timestamp      NOT NULL DEFAULT now(),
    fondo_inicial       numeric(12, 2) NOT NULL CHECK (fondo_inicial >= 0),
    cerrado_por         uuid           REFERENCES users (id) ON DELETE SET NULL,
    cerrado_por_nombre  varchar(120),
    cerrado_en          timestamp,
    -- Se congelan al cerrar: despues ya no cambian aunque se toquen los pedidos.
    efectivo_esperado   numeric(12, 2),
    efectivo_contado    numeric(12, 2),
    diferencia          numeric(12, 2),
    -- Billetes y monedas contados: {"500": 3, "0.5": 4}. Null si se capturo el total.
    conteo              jsonb,
    notas               varchar(500)
);

-- Una sola caja abierta por sucursal.
CREATE UNIQUE INDEX IF NOT EXISTS ux_turnos_caja_abierto
    ON turnos_caja (branch_id) WHERE cerrado_en IS NULL;
CREATE INDEX IF NOT EXISTS ix_turnos_caja_sucursal ON turnos_caja (branch_id, abierto_en DESC);

-- Como se pago cada cuenta. Una cuenta puede pagarse con varios metodos.
CREATE TABLE IF NOT EXISTS pagos (
    id                 uuid           PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id           uuid           NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
    turno_id           uuid           NOT NULL REFERENCES turnos_caja (id),
    payment_method_id  uuid           REFERENCES payment_methods (id) ON DELETE SET NULL,
    -- El nombre del metodo al momento de cobrar: si despues lo renombran, el
    -- arqueo viejo sigue diciendo lo que paso.
    metodo             varchar(100)   NOT NULL,
    es_efectivo        boolean        NOT NULL,
    monto              numeric(12, 2) NOT NULL CHECK (monto > 0),
    propina            numeric(12, 2) NOT NULL DEFAULT 0 CHECK (propina >= 0),
    -- Solo efectivo: con cuanto pago y cuanto cambio se le dio.
    recibido           numeric(12, 2),
    cambio             numeric(12, 2),
    cobrado_por        varchar(120),
    creado_en          timestamp      NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_pagos_turno ON pagos (turno_id);
CREATE INDEX IF NOT EXISTS ix_pagos_pedido ON pagos (order_id);

-- Efectivo que entra o sale del cajon sin ser venta: cambio que se trae,
-- retiros, gastos pagados de la caja, propinas repartidas.
CREATE TABLE IF NOT EXISTS movimientos_caja (
    id         uuid           PRIMARY KEY DEFAULT gen_random_uuid(),
    turno_id   uuid           NOT NULL REFERENCES turnos_caja (id) ON DELETE CASCADE,
    tipo       varchar(10)    NOT NULL CHECK (tipo IN ('ENTRADA', 'SALIDA')),
    monto      numeric(12, 2) NOT NULL CHECK (monto > 0),
    concepto   varchar(200)   NOT NULL,
    por        varchar(120),
    creado_en  timestamp      NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_movimientos_caja_turno ON movimientos_caja (turno_id);

-- El efectivo que entrega el repartidor en su corte entra a la caja abierta.
ALTER TABLE cortes_repartidor ADD COLUMN IF NOT EXISTS turno_id uuid REFERENCES turnos_caja (id);

-- ---------------------------------------------------------------------------
-- Permiso de caja
-- ---------------------------------------------------------------------------
-- Cobrar una cuenta sigue con ORDERS_UPDATE (lo hace el mesero); abrir, cerrar
-- y sacar o meter efectivo es de quien responde por la caja.
INSERT INTO permissions (name, description) VALUES
    ('CAJA_OPERAR', 'Abrir y cerrar la caja, registrar entradas y salidas de efectivo y ver el arqueo.')
ON CONFLICT (name) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE p.name = 'CAJA_OPERAR'
  AND r.restaurant_id IS NULL
  AND r.name IN ('SUPER_ADMIN', 'BRANCH_MANAGER')
ON CONFLICT DO NOTHING;
