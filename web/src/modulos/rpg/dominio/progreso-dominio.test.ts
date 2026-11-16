/** Iteración 6 (R1–R3, R6): tramos, racha por semanas cerradas, logros y niveles de atributo. Funciones puras. */
import { describe, expect, it } from 'vitest';
import { crearZona } from '../../../nucleo/dominio/zona-horaria';
import reglasV1 from '../reglas.v1.json';
import { logrosCumplidos, sumarContadores, type EstadoParaLogros } from './logros';
import { progresoPara } from './nivel';
import { evaluarSemana, finDeSemanaMs, lunesDe, multiplicadorDeRacha, RACHA_INICIAL, semanaIso, semanasCerradas, type EstadoDeRacha } from './racha';
import { calcularXp, indexarReglas, validarConfiguracion, type HistoriaParaElCalculo } from './reglas';

const CFG = validarConfiguracion(reglasV1);
const REGLAS = indexarReglas(CFG);
const BOGOTA = crearZona('America/Bogota');
const historia = (c: Partial<HistoriaParaElCalculo> = {}): HistoriaParaElCalculo => ({ acumuladoHoy: 0, yaOtorgado: false, cantidadHoy: 0, semanasDeRacha: 0, racha: CFG.racha, ...c });

describe('R1 · tramos diarios (reemplazan el tope provisional)', () => {
  const pomodoro = REGLAS.get('estudio.PomodoroCompletado')!;
  it('12 Pomodoros = 8 × 10 + 4 × 5 = 100; el 13.º da 0 con "tramo reducido"', () => {
    const xp = Array.from({ length: 13 }, (_, i) => calcularXp(pomodoro, {}, historia({ cantidadHoy: i })));
    expect(xp.slice(0, 12).reduce((n, c) => n + c.xp, 0)).toBe(100);
    expect(xp[7]).toEqual({ xpBase: 10, xp: 10 });
    expect(xp[8]).toEqual({ xpBase: 10, xp: 5, nota: 'tramo-reducido' });
    expect(xp[12]).toEqual({ xpBase: 10, xp: 0, nota: 'tramo-reducido' });
    expect(pomodoro.limiteDiarioXp).toBeUndefined(); // el tope provisional de 80 ya no está
  });
});

describe('R2 · multiplicador de racha', () => {
  const entregado = REGLAS.get('universidad.TrabajoEntregado')!;
  const taller = { tipo: 'taller', aTiempo: true, minutosDesdeCreacion: 60, peso: null };
  it('taller a tiempo = 24; con racha de 3 semanas × 1,15 = 27; tope × 1,30 desde 6 semanas', () => {
    expect(calcularXp(entregado, taller, historia()).xp).toBe(24);
    expect(calcularXp(entregado, taller, historia({ semanasDeRacha: 3 })).xp).toBe(27);
    expect(calcularXp(entregado, taller, historia({ semanasDeRacha: 10 })).xp).toBe(31); // 24 × 1,3 = 31,2
    expect(multiplicadorDeRacha(3, CFG.racha)).toBeCloseTo(1.15);
    expect(multiplicadorDeRacha(9, CFG.racha)).toBeCloseTo(1.3);
  });
  it('el bono de semana cumplida no se multiplica; los tramos van antes que la racha', () => {
    expect(calcularXp(REGLAS.get('rpg.SemanaDeRachaCumplida')!, { semana: '2026-W47' }, historia({ semanasDeRacha: 6 })).xp).toBe(50);
    expect(calcularXp(REGLAS.get('estudio.PomodoroCompletado')!, {}, historia({ cantidadHoy: 9, semanasDeRacha: 2 })).xp).toBe(5); // 5 × 1,1 = 5,5 → 5
  });
});

describe('R2 · semanas (lunes a domingo, Bogotá)', () => {
  it('lunes, semana ISO y cierre; la semana 53 de 2026 cruza el año', () => {
    expect(lunesDe('2026-11-22')).toBe('2026-11-16'); // domingo → su lunes
    expect(semanaIso('2026-12-31')).toBe('2026-W53');
    expect(semanaIso('2027-01-03')).toBe('2026-W53');
    expect(semanaIso('2027-01-04')).toBe('2027-W01');
    expect(new Date(finDeSemanaMs('2026-12-28', BOGOTA)).toISOString()).toBe('2027-01-04T05:00:00.000Z');
  });

  it('semanas cerradas en orden hasta un instante: el domingo 23:59 aún no cierra; el lunes 00:00 sí', () => {
    const domingo2359 = Date.parse('2026-11-23T04:59:00Z');
    expect(semanasCerradas('2026-11-09', domingo2359, BOGOTA)).toEqual(['2026-11-09']);
    expect(semanasCerradas('2026-11-09', Date.parse('2026-11-23T05:00:00Z'), BOGOTA)).toEqual(['2026-11-09', '2026-11-16']);
    // Tres semanas sin abrir la app: se evalúan las tres, en orden.
    expect(semanasCerradas('2026-12-21', Date.parse('2027-01-12T15:00:00Z'), BOGOTA)).toEqual(['2026-12-21', '2026-12-28', '2027-01-04']);
  });

  it('cumplida, comodín cada 4 (máximo 2), comodín consumido, racha perdida sin perder nada más', () => {
    const r = CFG.racha;
    let e: EstadoDeRacha = RACHA_INICIAL;
    const resultados: string[] = [];
    for (const dias of [4, 5, 7, 4, 4, 4, 4, 4, 4, 4, 4, 4, 1, 0, 0]) {
      const s = evaluarSemana(e, dias, r);
      resultados.push(`${s.resultado}${s.comodinGanado ? '+c' : ''}`);
      e = s.estado;
    }
    expect(resultados).toEqual([
      'cumplida', 'cumplida', 'cumplida', 'cumplida+c',
      'cumplida', 'cumplida', 'cumplida', 'cumplida+c',
      'cumplida', 'cumplida', 'cumplida', 'cumplida', // ya tiene 2: no gana más
      'comodin', 'comodin', 'perdida',
    ]);
    expect(e).toEqual({ semanas: 0, comodines: 0, cumplidasParaComodin: 0 });
    expect(evaluarSemana(RACHA_INICIAL, 3, r)).toMatchObject({ resultado: 'sin-racha', estado: RACHA_INICIAL });
  });

  it('comodín usado: la racha sigue igual (no sube)', () => {
    const s = evaluarSemana({ semanas: 5, comodines: 1, cumplidasParaComodin: 1 }, 2, CFG.racha);
    expect(s).toMatchObject({ resultado: 'comodin', estado: { semanas: 5, comodines: 0 } });
  });
});

describe('R3 · logros desde configuración', () => {
  const vacio: EstadoParaLogros = { totales: {}, delDia: {}, semanasDeRacha: 0 };
  it('contadores: filtro por datos (aTiempo) y "una vez por" entidad', () => {
    const t = { id: 'trabajosATiempo', evento: 'universidad.TrabajoEntregado', donde: { aTiempo: true }, unaVezPor: 'trabajoId' };
    expect(sumarContadores([t], 'universidad.TrabajoEntregado', { aTiempo: true, trabajoId: 'x' }, () => false)).toEqual(['trabajosATiempo']);
    expect(sumarContadores([t], 'universidad.TrabajoEntregado', { aTiempo: false, trabajoId: 'x' }, () => false)).toEqual([]);
    expect(sumarContadores([t], 'universidad.TrabajoEntregado', { aTiempo: true, trabajoId: 'x' }, () => true)).toEqual([]); // ya contado
  });

  it('primer foco, semestre en marcha, maratón sano (mismo día), constancia (racha); idempotentes y varios a la vez', () => {
    expect(logrosCumplidos(CFG.logros, vacio, new Set())).toEqual([]);
    const estado: EstadoParaLogros = { totales: { pomodoros: 9, materias: 5, trabajosATiempo: 3 }, delDia: { pomodoros: 8, descansos: 4 }, semanasDeRacha: 4 };
    const ids = logrosCumplidos(CFG.logros, estado, new Set()).map((l) => l.id);
    expect(ids).toEqual(['primer-foco', 'semestre-en-marcha', 'constancia', 'maraton-sano']);
    expect(logrosCumplidos(CFG.logros, estado, new Set(ids))).toEqual([]);
    expect(logrosCumplidos(CFG.logros, { ...estado, delDia: { pomodoros: 8, descansos: 3 } }, new Set()).map((l) => l.id)).not.toContain('maraton-sano');
  });

  it('la configuración rechaza logros que apuntan a contadores inexistentes', () => {
    const malo = { ...reglasV1, logros: [{ id: 'x', nombre: 'rpg.logro.x', xp: 1, condiciones: [{ contador: 'nada', minimo: 1 }] }] };
    expect(() => validarConfiguracion(malo)).toThrow(/contador desconocido/);
  });
});

describe('R6 · niveles por atributo', () => {
  it('100 XP de Intelecto = nivel 2 con base 50; 141 = nivel 3', () => {
    expect(progresoPara(100, CFG.nivelDeAtributo).nivel).toBe(2);
    expect(progresoPara(141, CFG.nivelDeAtributo).nivel).toBe(3);
  });
});
