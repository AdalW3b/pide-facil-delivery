-- Una sola forma de escribir cada unidad.
--
-- Habia ingredientes en "kg", "lt", "litro", "l", "pza", "pieza"... y la
-- conversion comparaba textos: "lt" y "l" eran unidades distintas. Aqui solo
-- se cambia como se escribe; las cantidades no cambian (1 lt = 1 l).
-- Las mismas equivalencias estan en Unidades.java, que es la que usa el
-- sistema al guardar ingredientes y recetas nuevas.

CREATE OR REPLACE FUNCTION pg_temp.unidad_canonica(u text) RETURNS text AS $$
    SELECT CASE lower(trim(trailing '.' from trim(u)))
        WHEN 'gr' THEN 'g' WHEN 'grs' THEN 'g' WHEN 'gramo' THEN 'g' WHEN 'gramos' THEN 'g'
        WHEN 'kilo' THEN 'kg' WHEN 'kilos' THEN 'kg' WHEN 'kgs' THEN 'kg'
        WHEN 'kilogramo' THEN 'kg' WHEN 'kilogramos' THEN 'kg'
        WHEN 'mililitro' THEN 'ml' WHEN 'mililitros' THEN 'ml'
        WHEN 'lt' THEN 'l' WHEN 'lts' THEN 'l' WHEN 'litro' THEN 'l' WHEN 'litros' THEN 'l'
        WHEN 'pz' THEN 'pieza' WHEN 'pza' THEN 'pieza' WHEN 'pzas' THEN 'pieza'
        WHEN 'pzs' THEN 'pieza' WHEN 'piezas' THEN 'pieza'
        WHEN 'unidad' THEN 'pieza' WHEN 'unidades' THEN 'pieza'
        WHEN 'manojos' THEN 'manojo' WHEN 'tabletas' THEN 'tableta'
        ELSE lower(trim(trailing '.' from trim(u)))
    END
$$ LANGUAGE sql IMMUTABLE;

UPDATE ingredients
   SET unit_of_measure = pg_temp.unidad_canonica(unit_of_measure)
 WHERE unit_of_measure IS NOT NULL
   AND unit_of_measure <> pg_temp.unidad_canonica(unit_of_measure);

UPDATE recipe_items
   SET recipe_unit = pg_temp.unidad_canonica(recipe_unit)
 WHERE recipe_unit IS NOT NULL
   AND recipe_unit <> pg_temp.unidad_canonica(recipe_unit);
