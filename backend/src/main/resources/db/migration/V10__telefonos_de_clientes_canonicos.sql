-- Deja un solo cliente por persona.
--
-- El mismo celular llega escrito de varias formas: WhatsApp entrega
-- "5215512345678", el menu web recibe "+52 55 1234 5678" y a veces solo los
-- diez digitos. Como se comparaban tal cual, la misma persona quedo registrada
-- mas de una vez, con sus pedidos y sus visitas repartidos entre las copias.
--
-- Esta migracion fusiona esas copias y deja todos los telefonos en una sola
-- forma: 52 + los diez digitos nacionales. El codigo hace la misma conversion
-- antes de buscar o crear (ver TelefonoMx), asi que de aqui en adelante la
-- restriccion unica (restaurant_id, phone_number) que ya existia alcanza para
-- que no vuelva a pasar.

-- ---------------------------------------------------------------------------
-- 1. El telefono canonico de cada cliente
-- ---------------------------------------------------------------------------
CREATE TEMP TABLE _canon ON COMMIT DROP AS
SELECT
    c.id,
    c.restaurant_id,
    c.created_at,
    c.name,
    c.total_visits,
    c.last_visit,
    CASE
        -- Sin digitos no hay nada que normalizar: se respeta lo que haya.
        WHEN regexp_replace(c.phone_number, '\D', '', 'g') = '' THEN c.phone_number
        -- El 1 que WhatsApp antepone a los celulares mexicanos sobra.
        WHEN regexp_replace(c.phone_number, '\D', '', 'g') ~ '^521[0-9]{10}$'
            THEN '52' || right(regexp_replace(c.phone_number, '\D', '', 'g'), 10)
        -- Diez digitos sueltos: es nacional, se le pone el pais.
        WHEN regexp_replace(c.phone_number, '\D', '', 'g') ~ '^[0-9]{10}$'
            THEN '52' || regexp_replace(c.phone_number, '\D', '', 'g')
        ELSE regexp_replace(c.phone_number, '\D', '', 'g')
    END AS canonico
FROM customers c;

-- ---------------------------------------------------------------------------
-- 2. Cual de las copias sobrevive
-- ---------------------------------------------------------------------------
-- La mas antigua: es la ficha original del cliente, la que el bot viene usando
-- y a la que apunta su historial mas largo.
CREATE TEMP TABLE _superviviente ON COMMIT DROP AS
SELECT DISTINCT ON (restaurant_id, canonico)
       restaurant_id, canonico, id AS survivor_id
FROM _canon
ORDER BY restaurant_id, canonico, created_at ASC, id ASC;

-- ---------------------------------------------------------------------------
-- 3. Todo lo que colgaba de las copias pasa al superviviente
-- ---------------------------------------------------------------------------
-- Primero los pedidos: orders.customer_id borra en SET NULL, asi que si se
-- eliminara la copia antes, su historial se quedaria sin dueno.
UPDATE orders o
   SET customer_id = s.survivor_id
  FROM _canon c
  JOIN _superviviente s
    ON s.restaurant_id = c.restaurant_id AND s.canonico = c.canonico
 WHERE o.customer_id = c.id
   AND c.id <> s.survivor_id;

-- Las direcciones guardadas borran en CASCADE: mismo cuidado.
UPDATE customer_addresses a
   SET customer_id = s.survivor_id
  FROM _canon c
  JOIN _superviviente s
    ON s.restaurant_id = c.restaurant_id AND s.canonico = c.canonico
 WHERE a.customer_id = c.id
   AND c.id <> s.survivor_id;

-- ---------------------------------------------------------------------------
-- 4. El superviviente se queda con las visitas y el mejor nombre
-- ---------------------------------------------------------------------------
-- Las visitas se suman, porque estaban repartidas entre las copias. Del nombre
-- se toma el mas completo, descartando el marcador "Cliente" que se pone
-- cuando la persona todavia no se identifica.
WITH resumen AS (
    SELECT s.survivor_id,
           sum(coalesce(c.total_visits, 0)) AS visitas,
           max(c.last_visit)                AS ultima,
           (array_agg(c.name ORDER BY
                (c.name IS NULL OR c.name = 'Cliente'),
                length(c.name) DESC))[1]    AS mejor_nombre
      FROM _canon c
      JOIN _superviviente s
        ON s.restaurant_id = c.restaurant_id AND s.canonico = c.canonico
     GROUP BY s.survivor_id
)
UPDATE customers cu
   SET total_visits = resumen.visitas,
       last_visit   = resumen.ultima,
       name         = coalesce(resumen.mejor_nombre, cu.name)
  FROM resumen
 WHERE cu.id = resumen.survivor_id;

-- ---------------------------------------------------------------------------
-- 5. Fuera las copias, y todos los telefonos a su forma canonica
-- ---------------------------------------------------------------------------
DELETE FROM customers cu
 USING _canon c
  JOIN _superviviente s
    ON s.restaurant_id = c.restaurant_id AND s.canonico = c.canonico
 WHERE cu.id = c.id
   AND c.id <> s.survivor_id;

UPDATE customers cu
   SET phone_number = c.canonico
  FROM _canon c
 WHERE cu.id = c.id
   AND cu.phone_number <> c.canonico;
