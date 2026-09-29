/**
 * Unidades del inventario. Es la misma tabla que Unidades.java en el backend:
 * masa (g, kg) y volumen (ml, l) se convierten dentro de su familia; las de
 * conteo (pieza, manojo...) solo equivalen a sí mismas.
 */

const CONOCIDAS: Record<string, { familia: 'masa' | 'volumen'; factor: number }> = {
  g: { familia: 'masa', factor: 1 },
  kg: { familia: 'masa', factor: 1000 },
  ml: { familia: 'volumen', factor: 1 },
  l: { familia: 'volumen', factor: 1000 },
};

const ALIAS: Record<string, string> = {
  gr: 'g', grs: 'g', gramo: 'g', gramos: 'g',
  kilo: 'kg', kilos: 'kg', kgs: 'kg', kilogramo: 'kg', kilogramos: 'kg',
  mililitro: 'ml', mililitros: 'ml',
  lt: 'l', lts: 'l', litro: 'l', litros: 'l',
  pz: 'pieza', pza: 'pieza', pzas: 'pieza', pzs: 'pieza', piezas: 'pieza', unidad: 'pieza', unidades: 'pieza',
  manojos: 'manojo', tabletas: 'tableta',
};

/** Las que se ofrecen al crear un ingrediente. */
export const UNIDADES_DE_INVENTARIO: { valor: string; nombre: string }[] = [
  { valor: 'kg', nombre: 'Kilogramos (kg)' },
  { valor: 'g', nombre: 'Gramos (g)' },
  { valor: 'l', nombre: 'Litros (l)' },
  { valor: 'ml', nombre: 'Mililitros (ml)' },
  { valor: 'pieza', nombre: 'Piezas' },
  { valor: 'manojo', nombre: 'Manojos' },
];

/** "Kilos", " KG " y "kg" son la misma: "kg". */
export function unidadCanonica(unidad: string | null | undefined): string {
  if (!unidad) return '';
  const u = unidad.trim().toLowerCase().replace(/\.$/, '');
  return ALIAS[u] ?? u;
}

/** En qué unidades se puede escribir una receta de un ingrediente: kg → kg y g. */
export function unidadesCompatibles(unidadDelIngrediente: string | null | undefined): string[] {
  const u = unidadCanonica(unidadDelIngrediente);
  const info = CONOCIDAS[u];
  if (!info) return u ? [u] : [];
  return Object.entries(CONOCIDAS)
    .filter(([, v]) => v.familia === info.familia)
    .sort((a, b) => (a[0] === u ? -1 : b[0] === u ? 1 : 0))
    .map(([k]) => k);
}

/** 0.25 kg → 250 g. Si no se pueden convertir, regresa la cantidad igual. */
export function convertirUnidad(cantidad: number, desde: string, hacia: string): number {
  const a = unidadCanonica(desde);
  const b = unidadCanonica(hacia);
  if (!a || !b || a === b) return cantidad;
  const ua = CONOCIDAS[a];
  const ub = CONOCIDAS[b];
  if (!ua || !ub || ua.familia !== ub.familia) return cantidad;
  return (cantidad * ua.factor) / ub.factor;
}

const NUMERO = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 2 });

/** Para leer de un vistazo: 25 kg, 0.25 kg → 250 g, 1.5 l, 3 piezas. */
export function cantidadLegible(cantidad: number | null | undefined, unidad: string | null | undefined): string {
  const valor = Number(cantidad) || 0;
  let u = unidadCanonica(unidad);
  let v = valor;
  // Menos de 1 kg o 1 l se lee mejor en g o ml.
  if ((u === 'kg' || u === 'l') && Math.abs(v) > 0 && Math.abs(v) < 1) {
    v = v * 1000;
    u = u === 'kg' ? 'g' : 'ml';
  }
  if (u === 'pieza' || u === 'manojo' || u === 'tableta') {
    return `${NUMERO.format(v)} ${Math.abs(v) === 1 ? u : u + 's'}`;
  }
  return `${NUMERO.format(v)}${u ? ' ' + u : ''}`;
}
