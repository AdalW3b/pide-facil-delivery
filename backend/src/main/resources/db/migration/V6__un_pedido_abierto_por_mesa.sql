-- Una mesa no puede tener dos cuentas abiertas al mismo tiempo. Hoy nada lo
-- impide: si dos meseros abren la misma mesa a la vez, o el bot la abre mientras
-- alguien ya la abrio desde el panel, quedan dos pedidos vivos y los platillos
-- se reparten entre ambos sin que nadie lo note.
--
-- Es un indice unico PARCIAL: solo aplica a los pedidos abiertos con mesa. Los
-- cerrados no estorban (una mesa se usa muchas veces al dia) y los pedidos sin
-- mesa quedan fuera a proposito, porque el delivery no tiene mesa.

CREATE UNIQUE INDEX IF NOT EXISTS ux_orders_una_cuenta_abierta_por_mesa
    ON orders (table_id)
    WHERE status = 'OPEN' AND table_id IS NOT NULL;
