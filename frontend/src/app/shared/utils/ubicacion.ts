/** Coordenadas leídas de un texto, o el motivo por el que no se pudo. */
export type LecturaUbicacion =
  | { ok: true; latitud: number; longitud: number }
  | { ok: false; motivo: string | null };

/**
 * Saca las coordenadas de un enlace de Google Maps o de un par de números.
 *
 * Es la vía más común en la práctica: la gente comparte su ubicación por
 * WhatsApp y se pega ese enlace. Formatos: "@19.43,-99.13", "q=19.43,-99.13",
 * "!3d19.43!4d-99.13" o "19.43, -99.13" escrito a mano.
 */
export function leerUbicacion(texto: string): LecturaUbicacion {
  const limpio = texto.trim();
  if (!limpio) return { ok: false, motivo: null };

  const patrones = [
    /@(-?\d+\.\d+),\s*(-?\d+\.\d+)/,
    /[?&](?:q|query|ll)=(-?\d+\.\d+),\s*(-?\d+\.\d+)/,
    /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/,
    /^\s*(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)\s*$/,
  ];
  for (const patron of patrones) {
    const m = limpio.match(patron);
    if (m) {
      const latitud = parseFloat(m[1]);
      const longitud = parseFloat(m[2]);
      if (Math.abs(latitud) <= 90 && Math.abs(longitud) <= 180) {
        return { ok: true, latitud, longitud };
      }
    }
  }

  // Un enlace acortado (maps.app.goo.gl) no trae las coordenadas dentro.
  if (/goo\.gl|maps\.app/.test(limpio)) {
    return {
      ok: false,
      motivo: 'Ese enlace es corto y no trae las coordenadas. Ábrelo en el mapa y copia el enlace largo.',
    };
  }
  return { ok: false, motivo: null };
}
