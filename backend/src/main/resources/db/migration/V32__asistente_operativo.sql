-- Asistente operativo de cada restaurante.
--
-- Responde dudas de uso del sistema y consulta los datos del restaurante
-- (ventas, inventario, caja, pedidos) para sugerir. Cada restaurante elige su
-- proveedor de IA y pone su propia llave. Es un complemento: lo activa el
-- operador de la plataforma.

CREATE TABLE IF NOT EXISTS asistente_config (
    restaurant_id       uuid          PRIMARY KEY REFERENCES restaurants (id) ON DELETE CASCADE,
    -- El complemento contratado. Sin esto no se usa aunque haya llave.
    complemento_activo  boolean       NOT NULL DEFAULT false,
    proveedor           varchar(20)   CHECK (proveedor IS NULL OR proveedor IN ('ANTHROPIC', 'OPENAI', 'GEMINI', 'COMPATIBLE')),
    modelo              varchar(100),
    -- Solo para servicios compatibles con OpenAI (DeepSeek, Mistral, Groq...).
    url_base            varchar(300),
    -- La llave del proveedor, cifrada con la llave maestra del servidor.
    llave_cifrada       text,
    -- Los ultimos caracteres, para reconocerla en pantalla sin mostrarla.
    llave_final         varchar(8),
    resumen_diario      boolean       NOT NULL DEFAULT true,
    actualizado_en      timestamp,
    actualizado_por     varchar(120)
);

-- El personal que el dueño habilita. El dueño y los gerentes lo usan siempre.
ALTER TABLE users ADD COLUMN IF NOT EXISTS usa_asistente boolean NOT NULL DEFAULT false;

-- Cada pregunta y su respuesta: historial y consumo del mes.
CREATE TABLE IF NOT EXISTS asistente_mensajes (
    id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id   uuid          NOT NULL REFERENCES restaurants (id) ON DELETE CASCADE,
    branch_id       uuid          REFERENCES branches (id) ON DELETE SET NULL,
    user_id         uuid          REFERENCES users (id) ON DELETE SET NULL,
    pregunta        text          NOT NULL,
    respuesta       text,
    proveedor       varchar(20),
    modelo          varchar(100),
    herramientas    varchar(500),
    tokens_entrada  integer,
    tokens_salida   integer,
    creado_en       timestamp     NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_asistente_mensajes_restaurante ON asistente_mensajes (restaurant_id, creado_en DESC);
CREATE INDEX IF NOT EXISTS ix_asistente_mensajes_usuario ON asistente_mensajes (user_id, creado_en DESC);

-- El resumen de cada dia, por sucursal.
CREATE TABLE IF NOT EXISTS asistente_resumenes (
    id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id   uuid          NOT NULL REFERENCES restaurants (id) ON DELETE CASCADE,
    branch_id       uuid          NOT NULL REFERENCES branches (id) ON DELETE CASCADE,
    dia             date          NOT NULL,
    contenido       text          NOT NULL,
    creado_en       timestamp     NOT NULL DEFAULT now(),
    UNIQUE (branch_id, dia)
);
