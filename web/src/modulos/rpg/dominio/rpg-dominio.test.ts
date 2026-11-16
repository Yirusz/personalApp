import { describe, expect, it } from 'vitest';
import reglasV1 from '../reglas.v1.json';
import { progresoPara, xpParaNivel } from './nivel';
import { ConfiguracionInvalida, aplicarLimiteDiario, calcularXp, claveUnica, validarConfiguracion, xpBase } from './reglas';

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
      expect((e as Error).message).toMatch(/exactamente uno de xp, xpPorTalla, xpPorValor o xpDesdeDato/);
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

describe('condiciones de las reglas (unaVezPor, antelación, rapidez, puntualidad)', () => {
  const cfg = validarConfiguracion(reglasV1);
  const regla = (evento: string) => cfg.reglas.find((r) => r.evento === evento)!;
  const completado = regla('universidad.EntregableCompletado');
  const creado = regla('universidad.EntregableCreado');
  const sinHistoria = { acumuladoHoy: 0, yaOtorgado: false };

  it('puntualidad: un entregable M a tiempo da 35 × 1,2 = 42; tarde, 35 (sin castigo)', () => {
    const datos = { talla: 'M', aTiempo: true, minutosDesdeCreacion: 600 };
    expect(calcularXp(completado, datos, sinHistoria)).toEqual({ xpBase: 35, xp: 42 });
    expect(calcularXp(completado, { ...datos, aTiempo: false }, sinHistoria)).toEqual({ xpBase: 35, xp: 35 });
  });

  it('completado menos de 10 min después de crearlo: 0 XP con nota "muy-rapido"', () => {
    expect(calcularXp(completado, { talla: 'L', aTiempo: true, minutosDesdeCreacion: 5 }, sinHistoria)).toEqual({
      xpBase: 100,
      xp: 0,
      nota: 'muy-rapido',
    });
    // Sin el dato no se adivina: 0.
    expect(calcularXp(completado, { talla: 'L', aTiempo: true }, sinHistoria).xp).toBe(0);
  });

  it('registrar con 48 h o más de antelación da 3 XP; con menos, 0', () => {
    expect(calcularXp(creado, { antelacionHoras: 72 }, sinHistoria)).toEqual({ xpBase: 3, xp: 3 });
    expect(calcularXp(creado, { antelacionHoras: 48 }, sinHistoria).xp).toBe(3);
    expect(calcularXp(creado, { antelacionHoras: 47 }, sinHistoria)).toEqual({ xpBase: 3, xp: 0, nota: 'poca-antelacion' });
  });

  it('unaVezPor: si la entidad ya otorgó XP, no vuelve a otorgarla', () => {
    const datos = { talla: 'M', aTiempo: true, minutosDesdeCreacion: 600 };
    expect(calcularXp(completado, datos, { acumuladoHoy: 0, yaOtorgado: true })).toEqual({ xpBase: 35, xp: 0, nota: 'ya-otorgado' });
    expect(claveUnica(completado, { entregableId: 'e1' })).toBe('universidad.EntregableCompletado|e1');
    expect(claveUnica(completado, {})).toBeUndefined();
    expect(claveUnica(regla('estudio.DescansoCompletado'), { entregableId: 'e1' })).toBeUndefined();
  });

  it('el tope diario se aplica después de la puntualidad', () => {
    const datos = { talla: 'L', aTiempo: true, minutosDesdeCreacion: 600 };
    expect(calcularXp(completado, datos, { acumuladoHoy: 250, yaOtorgado: false })).toEqual({ xpBase: 100, xp: 50, nota: 'limite-diario' });
  });

  it('valida el tipo de unaVezPor', () => {
    const malo = { ...reglasV1, reglas: [{ evento: 'a.B', atributo: 'intelecto', xp: 1, unaVezPor: 3 }] };
    expect(() => validarConfiguracion(malo)).toThrow(/unaVezPor/);
  });
});

describe('XP por tipo de trabajo (ADR-0014)', () => {
  const cfg = validarConfiguracion(reglasV1);
  const entregado = cfg.reglas.find((r) => r.evento === 'universidad.TrabajoEntregado')!;
  const sinHistoria = { acumuladoHoy: 0, yaOtorgado: false };

  it('un parcial a tiempo con peso 25 % da 50 × 1,2 × 1,25 = 75; un tipo desconocido, 0', () => {
    expect(calcularXp(entregado, { tipo: 'parcial', aTiempo: true, peso: 250, minutosDesdeCreacion: 600 }, sinHistoria)).toEqual({ xpBase: 50, xp: 75 });
    expect(calcularXp(entregado, { tipo: 'tarea', aTiempo: false, peso: null, minutosDesdeCreacion: 600 }, sinHistoria)).toEqual({ xpBase: 10, xp: 10 });
    expect(calcularXp(entregado, { tipo: 'examen', minutosDesdeCreacion: 600 }, sinHistoria).xp).toBe(0);
  });

  it('valida xpPorValor y bonoPorUmbral', () => {
    const malo = { ...reglasV1, reglas: [{ evento: 'a.B', atributo: 'intelecto', xp: 1, xpPorValor: { campo: 'x', valores: {} } }] };
    expect(() => validarConfiguracion(malo)).toThrow(/exactamente uno/);
    const bono = { ...reglasV1, reglas: [{ evento: 'a.B', atributo: 'intelecto', xp: 1, bonoPorUmbral: { campo: 'p', minimo: 1, multiplicador: 0.5 } }] };
    expect(() => validarConfiguracion(bono)).toThrow(/bonoPorUmbral/);
  });
});
