import { describe, expect, it } from 'vitest';
import { colorDeAgenda, contraste, esColorDeAgenda, esColorHex, SUPERFICIES, variantesLegibles } from './color';

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
