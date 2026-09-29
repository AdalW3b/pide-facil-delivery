-- ============================================================================
--  Índices
--
--  PostgreSQL indexa sola la clave primaria y las columnas UNIQUE, pero NO
--  las claves foráneas. En un modelo con 17 tablas colgadas de restaurant_id
--  y branch_id, eso es la diferencia entre una analítica instantánea y una
--  que recorre la tabla entera.
--
--  El orden de las columnas del primer índice no es casual: es el filtro que
--  aparece en las nueve consultas de AnalyticsService — branch_id, luego
--  status, luego el rango sobre closed_at.
-- ============================================================================

-- ---------------------------------------------------------- la ruta caliente
CREATE INDEX ix_orders_sucursal_estado_cierre ON orders (branch_id, status, closed_at);
CREATE INDEX ix_orders_sucursal_creacion      ON orders (branch_id, created_at);
CREATE INDEX ix_orders_mesa                   ON orders (table_id);
CREATE INDEX ix_orders_comensal               ON orders (customer_id);

CREATE INDEX ix_order_items_pedido            ON order_items (order_id);
CREATE INDEX ix_order_items_producto          ON order_items (product_id);
-- La pantalla de cocina pide las comandas vivas ordenadas por antigüedad.
CREATE INDEX ix_order_items_cocina            ON order_items (kitchen_status);

-- ------------------------------------------------------------ claves foráneas
CREATE INDEX ix_branches_restaurante          ON branches (restaurant_id);
CREATE INDEX ix_users_restaurante             ON users (restaurant_id);
CREATE INDEX ix_users_sucursal                ON users (branch_id);
CREATE INDEX ix_users_rol                     ON users (role_id);
CREATE INDEX ix_roles_restaurante             ON roles (restaurant_id);
CREATE INDEX ix_tables_sucursal               ON tables (branch_id);
CREATE INDEX ix_categories_restaurante        ON categories (restaurant_id);
CREATE INDEX ix_products_categoria            ON products (category_id);
CREATE INDEX ix_ingredients_restaurante       ON ingredients (restaurant_id);
CREATE INDEX ix_recipe_items_producto         ON recipe_items (product_id);
CREATE INDEX ix_recipe_items_ingrediente      ON recipe_items (ingredient_id);
CREATE INDEX ix_payment_methods_sucursal      ON payment_methods (branch_id);

-- El agente de WhatsApp busca al comensal por teléfono dentro de su restaurante
-- en cada mensaje que entra.
CREATE INDEX ix_customers_restaurante_telefono ON customers (restaurant_id, phone_number);

-- Las tablas intermedias ya tienen índice por la primera columna de su clave
-- primaria; falta el sentido inverso.
CREATE INDEX ix_role_permissions_permiso      ON role_permissions (permission_id);
CREATE INDEX ix_user_tables_mesa              ON user_tables (table_id);
