-- La marca del restaurante: el nombre, el color y el logo que ven sus clientes
-- (menu en linea, kiosko, su cuenta) y su equipo (panel, repartidores).
--
-- Solo cambia como se ve. Una tabla aparte para que el logo no viaje cada vez
-- que se lee un restaurante. Sin fila, el restaurante se ve como Pide Facil.

CREATE TABLE IF NOT EXISTS marca_restaurante (
    restaurant_id   uuid PRIMARY KEY REFERENCES restaurants (id) ON DELETE CASCADE,
    -- El nombre que se muestra; null = el nombre del restaurante.
    nombre          varchar(60),
    -- Color principal en #RRGGBB; null = los colores de Pide Facil.
    color           varchar(7),
    -- PNG ya reducido por el servidor (hasta 512 px por lado).
    logo            bytea,
    -- Version del logo en la URL: al cambiarlo, el navegador no se queda con el viejo.
    logo_version    timestamp,
    actualizado_en  timestamp    NOT NULL
);
