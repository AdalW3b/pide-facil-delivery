/**
 * La paleta de la marca del restaurante.
 *
 * Las pantallas usan los colores de Tailwind (indigo en el panel, naranja en
 * el menú del cliente) y Tailwind los pinta con variables CSS
 * (`--color-indigo-500`). Para aplicar la marca basta con cambiar esas
 * variables: ninguna pantalla cambia sus clases.
 *
 * Cada tono conserva la luminosidad del tono original de Tailwind y toma el
 * matiz del color del restaurante. Así el texto blanco sobre un botón sigue
 * leyéndose aunque el dueño elija un amarillo claro.
 */

/** Tonos de Tailwind: [tono, luminosidad, croma] en OKLCH. */
type Escala = readonly (readonly [number, number, number])[];

const INDIGO: Escala = [
  [50, 0.962, 0.018], [100, 0.93, 0.034], [200, 0.87, 0.065], [300, 0.785, 0.115], [400, 0.673, 0.182],
  [500, 0.585, 0.233], [600, 0.511, 0.262], [700, 0.457, 0.24], [800, 0.398, 0.195], [900, 0.359, 0.144],
  [950, 0.257, 0.09],
];
const VIOLETA: Escala = [
  [50, 0.969, 0.016], [100, 0.943, 0.029], [200, 0.894, 0.057], [300, 0.811, 0.111], [400, 0.702, 0.183],
  [500, 0.606, 0.25], [600, 0.541, 0.281], [700, 0.491, 0.27], [800, 0.432, 0.232], [900, 0.38, 0.189],
  [950, 0.283, 0.141],
];
const NARANJA: Escala = [
  [50, 0.98, 0.016], [100, 0.954, 0.038], [200, 0.901, 0.076], [300, 0.837, 0.128], [400, 0.75, 0.183],
  [500, 0.705, 0.213], [600, 0.646, 0.222], [700, 0.553, 0.195], [800, 0.47, 0.157], [900, 0.408, 0.123],
  [950, 0.266, 0.079],
];

/** Familias de Tailwind que hacen de color de acento en alguna pantalla. */
const FAMILIAS: Record<string, Escala> = { indigo: INDIGO, violet: VIOLETA, orange: NARANJA };

/** Croma de un color "vivo": a partir de aquí la paleta sale con la intensidad de Tailwind. */
const CROMA_VIVO = 0.2;

export function esColorValido(hex: string | null | undefined): hex is string {
  return !!hex && /^#[0-9a-fA-F]{6}$/.test(hex);
}

/** #RRGGBB a OKLCH: [luminosidad 0-1, croma, matiz en grados]. */
export function hexAOklch(hex: string): [number, number, number] {
  const canal = (i: number) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  const r = canal(1), g = canal(3), b = canal(5);

  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);

  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;

  const C = Math.sqrt(A * A + B * B);
  let H = (Math.atan2(B, A) * 180) / Math.PI;
  if (H < 0) H += 360;
  return [L, C, H];
}

/**
 * Las variables CSS a cambiar para un color: `--color-indigo-500` y demás.
 * Un color gris da una paleta gris; uno vivo, una con la intensidad de Tailwind.
 */
export function variablesDeMarca(hex: string): Record<string, string> {
  const [, croma, matiz] = hexAOklch(hex);
  const intensidad = Math.min(croma / CROMA_VIVO, 1.2);
  const variables: Record<string, string> = {};
  for (const [familia, escala] of Object.entries(FAMILIAS)) {
    for (const [tono, luz, c] of escala) {
      variables[`--color-${familia}-${tono}`] =
        `oklch(${(luz * 100).toFixed(1)}% ${(c * intensidad).toFixed(3)} ${matiz.toFixed(1)})`;
    }
  }
  return variables;
}

/** Todas las variables que la marca puede tocar, para devolverlas a las de Tailwind. */
export function todasLasVariablesDeMarca(): string[] {
  return Object.entries(FAMILIAS).flatMap(([familia, escala]) =>
    escala.map(([tono]) => `--color-${familia}-${tono}`),
  );
}
