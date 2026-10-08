import { esColorValido, hexAOklch, todasLasVariablesDeMarca, variablesDeMarca } from './paleta';

describe('paleta de la marca', () => {
  it('convierte #RRGGBB a OKLCH', () => {
    const [l, c] = hexAOklch('#FFFFFF');
    expect(l).toBeCloseTo(1, 3);
    expect(c).toBeCloseTo(0, 3);

    // El indigo-500 de Tailwind v3 (#6366F1) cae cerca del matiz 277.
    const [, , h] = hexAOklch('#6366F1');
    expect(h).toBeGreaterThan(270);
    expect(h).toBeLessThan(285);
  });

  it('pinta las tres familias de acento con el matiz del restaurante', () => {
    const v = variablesDeMarca('#C8381F');
    expect(Object.keys(v)).toEqual(todasLasVariablesDeMarca());
    expect(v['--color-indigo-600']).toMatch(/^oklch\(51\.1% [0-9.]+ 3[0-9]\.[0-9]\)$/);
    expect(v['--color-orange-500']).toMatch(/^oklch\(70\.5% /);
  });

  it('conserva la luminosidad de cada tono aunque el color sea claro', () => {
    // Un amarillo claro no debe dejar los botones claros: el texto blanco no se leería.
    expect(variablesDeMarca('#FDE047')['--color-indigo-600']).toMatch(/^oklch\(51\.1% /);
  });

  it('un gris da una paleta gris', () => {
    const croma = Number(variablesDeMarca('#808080')['--color-indigo-500'].split(' ')[1]);
    expect(croma).toBeLessThan(0.01);
  });

  it('valida el formato del color', () => {
    expect(esColorValido('#a1B2c3')).toBe(true);
    expect(esColorValido('#abc')).toBe(false);
    expect(esColorValido('rojo')).toBe(false);
    expect(esColorValido(null)).toBe(false);
  });
});
