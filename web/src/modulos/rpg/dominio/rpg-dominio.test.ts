import { describe, expect, it } from 'vitest';
import reglasV1 from '../reglas.v1.json';
import { progresoPara, xpParaNivel } from './nivel';
import { ConfiguracionInvalida, aplicarLimiteDiario, validarConfiguracion, xpBase } from './reglas';

const P = { base: 100, exponente: 1.5 };

describe('fórmula de nivel', () => {
  it('XP acumulada = ⌊100·(n−1)^1,5⌋', () => {
    expect([1, 2, 3, 5, 10, 20].map((n) => xpParaNivel(n, P))).toEqual([0, 100, 282, 800, 2700, 8281]);
  });

  it('calcula nivel y avance dentro del nivel', () => {
    expect(progresoPara(0, P)).toMatchObject({ nivel: 1, xpEnNivel: 0, xpDelTramo: 100 });
    expect(progresoPara(99, P).nivel).toBe(1);
    expect(progresoPara(100, P)).toMatchObject({ nivel: 2, xpEnNivel: 0, xpDelTramo: 182 });
    expect(progresoPara(2700, P).nivel).toBe(10);
  });

  it('rechaza XP negativa', () => {
    expect(() => progresoPara(-1, P)).toThrow(RangeError);
  });
});

describe('reglas v1', () => {
  it('el archivo reglas.v1.json es válido', () => {
    expect(() => validarConfiguracion(reglasV1)).not.toThrow();
  });

  it('detecta errores de configuración con mensajes claros', () => {
    const malo = {
      ...reglasV1,
      reglas: [
        { evento: 'sin-punto', xp: 1, atributo: 'intelecto' },
        { evento: 'a.B', atributo: 'fuerza', xp: 1 },
        { evento: 'a.C', atributo: 'intelecto' },
      ],
    };
    expect(() => validarConfiguracion(malo)).toThrow(ConfiguracionInvalida);
    try {
      validarConfiguracion(malo);
    } catch (e) {
      expect((e as Error).message).toMatch(/evento inválido/);
      expect((e as Error).message).toMatch(/atributo desconocido: fuerza/);
      expect((e as Error).message).toMatch(/exactamente uno de xp o xpPorTalla/);
    }
  });

  it('partir una tarea L en varias más pequeñas no da más XP', () => {
    const cfg = validarConfiguracion(reglasV1);
    const regla = cfg.reglas.find((r) => r.evento === 'universidad.EntregableCompletado')!;
    const [s, m, l] = (['S', 'M', 'L'] as const).map((talla) => xpBase(regla, { talla }));
    expect(3 * m!).toBeLessThanOrEqual(l! * 1.1); // ~ neutro
    expect(3 * s!).toBeLessThan(m!);
  });

  it('talla desconocida no otorga XP', () => {
    const regla = { evento: 'a.B', atributo: 'x', xpPorTalla: { S: 10 } };
    expect(xpBase(regla, { talla: 'XL' })).toBe(0);
  });

  it('el límite diario nunca da XP negativa ni pasa del tope', () => {
    expect(aplicarLimiteDiario(10, 0, 5)).toBe(5);
    expect(aplicarLimiteDiario(10, 5, 5)).toBe(0);
    expect(aplicarLimiteDiario(10, 8, 5)).toBe(0);
    expect(aplicarLimiteDiario(10, 0, undefined)).toBe(10);
  });
});
