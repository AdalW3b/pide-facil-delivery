-- Gastos del restaurante que no son compras de mercancia: renta, luz, agua,
-- gas, nomina, mantenimiento… Cuentan como egreso en "Ingresos y egresos".

-- Los que se repiten cada mes: la pantalla avisa cuales faltan por pagar.
CREATE TABLE IF NOT EXISTS gastos_fijos (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id     uuid           NOT NULL REFERENCES branches (id) ON DELETE CASCADE,
    -- RENTA, LUZ, AGUA, GAS, NOMINA, INTERNET, MANTENIMIENTO, IMPUESTOS u OTRO.
    categoria     varchar(20)    NOT NULL,
    concepto      varchar(120)   NOT NULL,
    -- Lo de siempre; al pagarlo se puede cambiar (el recibo de luz varia).
    monto         numeric(12,2)  NOT NULL CHECK (monto > 0),
    -- Que dia del mes se paga (31 = el ultimo dia en meses mas cortos).
    dia_del_mes   integer        NOT NULL CHECK (dia_del_mes BETWEEN 1 AND 31),
    activo        boolean        NOT NULL DEFAULT true,
    creado_en     timestamp      NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_gastos_fijos_sucursal ON gastos_fijos (branch_id);

CREATE TABLE IF NOT EXISTS gastos (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id           uuid           NOT NULL REFERENCES branches (id) ON DELETE CASCADE,
    categoria           varchar(20)    NOT NULL,
    concepto            varchar(120)   NOT NULL,
    monto               numeric(12,2)  NOT NULL CHECK (monto > 0),
    -- Cuando se pago; nunca futura.
    fecha               date           NOT NULL,
    -- CAJA (efectivo del cajon), TRANSFERENCIA o TARJETA.
    forma_pago          varchar(15)    NOT NULL,
    nota                varchar(300),
    gasto_fijo_id       uuid           REFERENCES gastos_fijos (id) ON DELETE SET NULL,
    -- La salida de efectivo que se registro en la caja.
    movimiento_caja_id  uuid,
    usuario             varchar(100),
    creado_en           timestamp      NOT NULL DEFAULT now(),
    anulado_en          timestamp,
    anulado_por         varchar(100)
);
CREATE INDEX IF NOT EXISTS ix_gastos_sucursal_fecha ON gastos (branch_id, fecha DESC);
CREATE INDEX IF NOT EXISTS ix_gastos_fijo ON gastos (gasto_fijo_id);
