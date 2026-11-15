import { describe, expect, it } from 'vitest';
import { aleatorioDeterminista } from '../../pruebas/entorno';
import { RelojFijo } from './reloj';
import { GeneradorUuidV7, esUuidV7, marcaDeTiempoDe } from './uuidv7';

const nuevo = (instante = '2026-11-14T15:00:00.000Z') => {
  const reloj = new RelojFijo(instante);
  return { reloj, gen: new GeneradorUuidV7(reloj, aleatorioDeterminista()) };
};

describe('UUIDv7', () => {
  it('cumple el formato de RFC 9562 (versión 7 y variante 10xx)', () => {
    const { gen } = nuevo();
    for (let i = 0; i < 100; i++) expect(esUuidV7(gen.siguiente())).toBe(true);
  });

  it('codifica la marca de tiempo del reloj inyectado', () => {
    const { gen } = nuevo('2026-11-14T15:00:00.123Z');
    expect(marcaDeTiempoDe(gen.siguiente())).toBe(Date.parse('2026-11-14T15:00:00.123Z'));
  });

  it('es estrictamente creciente dentro del mismo milisegundo', () => {
    const { gen } = nuevo();
    const ids = Array.from({ length: 5000 }, () => gen.siguiente());
    for (let i = 1; i < ids.length; i++) expect(ids[i]! > ids[i - 1]!).toBe(true);
  });

  it('sigue creciendo aunque el reloj retroceda', () => {
    const { reloj, gen } = nuevo();
    const antes = gen.siguiente();
    reloj.avanzar(-60_000);
    expect(gen.siguiente() > antes).toBe(true);
  });

  it('asegurarPosteriorA continúa después de un id existente (reinicio con reloj atrasado)', () => {
    const futuro = nuevo('2030-01-01T00:00:00.000Z').gen.siguiente();
    const { gen } = nuevo('2026-01-01T00:00:00.000Z');
    gen.asegurarPosteriorA(futuro);
    expect(gen.siguiente() > futuro).toBe(true);
  });

  it('rechaza textos que no son UUIDv7', () => {
    expect(esUuidV7('123e4567-e89b-12d3-a456-426614174000')).toBe(false);
    expect(() => marcaDeTiempoDe('no-es-uuid')).toThrow(TypeError);
  });
});
