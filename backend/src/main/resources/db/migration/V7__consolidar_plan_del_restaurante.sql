-- Habia dos columnas de plan con datos que se contradecian:
--   subscription_plan : la que escribe el registro y la facturacion de OmniRest
--   plan              : la que se creo del lado de Pide Facil, con PRO en todos
--
-- subscription_plan pasa a ser la unica fuente de verdad. El plan decide los
-- limites de sucursales y usuarios, y tambien si el restaurante tiene delivery.

-- 1. Rellenar los huecos de subscription_plan. Se respeta el valor que ya
--    tenga; si esta vacio se toma el de la columna vieja y, en ultimo caso,
--    INICIAL, que es el plan mas conservador.
UPDATE restaurants
SET subscription_plan = COALESCE(NULLIF(TRIM(subscription_plan), ''), NULLIF(TRIM(plan), ''), 'INICIAL')
WHERE NULLIF(TRIM(subscription_plan), '') IS NULL;

-- 2. Normalizar a los tres valores validos. Cualquier cosa distinta se trata
--    como INICIAL, para no dar funciones de pago por un dato mal escrito.
UPDATE restaurants
SET subscription_plan = 'INICIAL'
WHERE UPPER(TRIM(subscription_plan)) NOT IN ('INICIAL', 'PRO', 'CADENA');

UPDATE restaurants SET subscription_plan = UPPER(TRIM(subscription_plan));

-- 3. Dejar la columna vieja en el mismo valor, para que ningun codigo que
--    todavia la lea vea algo distinto. Queda obsoleta: no se escribe mas.
UPDATE restaurants SET plan = subscription_plan;

COMMENT ON COLUMN restaurants.subscription_plan IS
    'Plan comercial: INICIAL, PRO o CADENA. Unica fuente de verdad.';
COMMENT ON COLUMN restaurants.plan IS
    'OBSOLETA: usar subscription_plan. Se conserva para no romper otro backend que aun la lee.';

-- 4. Que la base tampoco admita valores fuera de los tres planes.
ALTER TABLE restaurants DROP CONSTRAINT IF EXISTS restaurants_subscription_plan_check;
ALTER TABLE restaurants ADD CONSTRAINT restaurants_subscription_plan_check
    CHECK (subscription_plan IS NULL OR subscription_plan IN ('INICIAL', 'PRO', 'CADENA'));
