-- Fotos de los platillos para el menu en linea.
--
-- Se guardan en la base, como el PDF del menu: los respaldos siguen siendo uno
-- solo. Van ya reducidas por el servidor (unos 150 KB la grande, 30 KB la
-- miniatura), asi que no pesan como una foto recien tomada con el telefono.
-- Si algun dia son muchas, se pueden mover a un almacenamiento de archivos sin
-- tocar el menu: el menu solo conoce la URL.

CREATE TABLE IF NOT EXISTS fotos_producto (
    product_id      uuid PRIMARY KEY REFERENCES products (id) ON DELETE CASCADE,
    -- Para la ficha del platillo: hasta 1200 px de ancho.
    grande          bytea        NOT NULL,
    -- Para la lista del menu: cuadrada de 400 px.
    miniatura       bytea        NOT NULL,
    tipo            varchar(20)  NOT NULL DEFAULT 'image/jpeg',
    -- Tambien sirve de version en la URL: al cambiar la foto cambia la URL y
    -- el navegador no se queda con la vieja en cache.
    actualizado_en  timestamp    NOT NULL
);
