/**
 * Qué restaurante y sucursal abrir en una pantalla del panel: la del propio
 * usuario si está en la lista; si no, la primera. Así todas las pantallas
 * abren la misma sucursal que muestra la barra superior.
 */
export function sucursalInicial(
  restaurantes: { id: string; branches?: { id: string }[] | null }[],
  propia: string | null,
): { restaurantId: string; branchId: string } | null {
  const conPropia = propia ? restaurantes.find((r) => r.branches?.some((b) => b.id === propia)) : undefined;
  if (conPropia && propia) return { restaurantId: conPropia.id, branchId: propia };
  const primero = restaurantes.find((r) => r.branches && r.branches.length > 0);
  return primero ? { restaurantId: primero.id, branchId: primero.branches![0].id } : null;
}
