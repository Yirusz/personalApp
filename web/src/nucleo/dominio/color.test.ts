import { describe, expect, it } from 'vitest';
import { colorDeAgenda, contraste, esColorDeAgenda, esColorHex, hexDesdeHsv, hsvDesdeHex, rellenoLegible, SUPERFICIES, textoSobre, variantesLegibles } from './color';

describe('Color de agenda: token o #rrggbb (ADR-0015)', () => {
  it('acepta tokens y hex de 6 dígitos, normaliza a minúsculas', () => {
    expect(esColorHex('#1A2b3C')).toBe(true);
    expect(esColorHex('#abc')).toBe(false);
    expect(esColorHex('azul')).toBe(false);
    expect(esColorDeAgenda('azul')).toBe(true);
    expect(esColorDeAgenda('#00ff00')).toBe(true);
    expect(esColorDeAgenda('rgb(0,0,0)')).toBe(false);
    expect(colorDeAgenda(' #1A2B3C ')).toBe('#1a2b3c');
    expect(colorDeAgenda('verde')).toBe('verde');
    expect(() => colorDeAgenda('#12')).toThrow();
  });

  it('contraste WCAG', () => {
    expect(contraste('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contraste('#ffffff', '#ffffff')).toBeCloseTo(1, 5);
  });

  it('un color que ya contrasta no se toca', () => {
    expect(variantesLegibles('#1565c0').claro).toBe('#1565c0');
    expect(variantesLegibles('#64b5f6').oscuro).toBe('#64b5f6');
  });

  it('amarillo claro se oscurece en tema claro; azul marino se aclara en tema oscuro (≥ 3:1 contra fondo y superficie)', () => {
    for (const hex of ['#ffeb3b', '#fff9c4', '#0d1b2a', '#000000', '#ffffff', '#808080']) {
      const v = variantesLegibles(hex);
      for (const s of SUPERFICIES.claro) expect(contraste(v.claro, s)).toBeGreaterThanOrEqual(3);
      for (const s of SUPERFICIES.oscuro) expect(contraste(v.oscuro, s)).toBeGreaterThanOrEqual(3);
    }
    expect(variantesLegibles('#ffeb3b').claro).not.toBe('#ffeb3b');
    expect(variantesLegibles('#0d1b2a').oscuro).not.toBe('#0d1b2a');
  });
});

describe('Selector integrado: HSV ↔ hex y texto sobre color', () => {
  it('convierte ida y vuelta sin perder el color', () => {
    expect(hexDesdeHsv({ h: 0, s: 100, v: 100 })).toBe('#ff0000');
    expect(hexDesdeHsv({ h: 120, s: 100, v: 50 })).toBe('#008000');
    expect(hexDesdeHsv({ h: 0, s: 0, v: 100 })).toBe('#ffffff');
    expect(hsvDesdeHex('#ff0000')).toEqual({ h: 0, s: 100, v: 100 });
    expect(hsvDesdeHex('#000000')).toEqual({ h: 0, s: 0, v: 0 });
    for (const hex of ['#ff7043', '#1565c0', '#8d6e00', '#123456', '#fedcba']) {
      const ida = hexDesdeHsv(hsvDesdeHex(hex));
      // Redondeo a enteros en HSV: como mucho ±2 por canal.
      for (const i of [1, 3, 5]) expect(Math.abs(parseInt(ida.slice(i, i + 2), 16) - parseInt(hex.slice(i, i + 2), 16))).toBeLessThanOrEqual(2);
    }
  });

  it('acota valores fuera de rango (h 360 = 0; s, v entre 0 y 100)', () => {
    expect(hexDesdeHsv({ h: 360, s: 150, v: -5 })).toBe('#000000');
    expect(hexDesdeHsv({ h: -30, s: 100, v: 100 })).toBe(hexDesdeHsv({ h: 330, s: 100, v: 100 }));
  });

  it('barras rellenas: fondo y texto con al menos 4,5:1, incluso con grises medios', () => {
    for (const hex of ['#ffeb3b', '#0d1b2a', '#ff7043', '#1565c0', '#808080', '#767676', '#7a7a7a', '#ffffff', '#000000', '#00bcd4']) {
      for (const variante of Object.values(variantesLegibles(hex))) {
        const r = rellenoLegible(variante);
        expect(contraste(r.texto, r.fondo)).toBeGreaterThanOrEqual(4.5);
      }
    }
    expect(textoSobre('#ffeb3b')).toBe('#111614');
    expect(textoSobre('#1565c0')).toBe('#ffffff');
    expect(rellenoLegible('#1565c0')).toEqual({ fondo: '#1565c0', texto: '#ffffff' });
  });
});
