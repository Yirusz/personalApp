/** Dominio de Estudio (E1, E2, E4, E5): todo con reloj falso, sin ticks. */
import { describe, expect, it } from 'vitest';
import { crearZona } from '../../../nucleo/dominio/zona-horaria';
import { CONFIGURACION_INICIAL, validarConfiguracion } from './configuracion';
import { resumen } from './estadisticas';
import { completar, estaPausada, estaVencida, finPrevistoMs, iniciar, interrumpir, pausar, reanudar, restanteMs, saltar, siguiente, type SesionTerminada } from './sesion';

const BOGOTA = crearZona('America/Bogota');
const MIN = 60_000;
const T0 = Date.parse('2026-11-16T14:00:00Z'); // lunes 9:00 en Bogotá
const en = (min: number) => new Date(T0 + min * MIN);
const CALCULO = { tipo: 'universidad.materia', id: 'm1' };

const foco = (cambios: Partial<Parameters<typeof iniciar>[0]> = {}) => iniciar({ id: 's1', fase: 'foco', duracionMin: 25, vinculo: CALCULO, ahora: en(0), ...cambios });

describe('E5 · el tiempo sale del reloj, no de los ticks', () => {
  it('restante = fin calculado − ahora; tras congelar 30 min la sesión figura terminada a los 25 exactos', () => {
    const s = foco();
    expect(restanteMs(s, en(10).getTime())).toBe(15 * MIN);
    expect(estaVencida(s, en(24).getTime())).toBe(false);
    // Android congela la app; vuelve a los 30 min
    expect(estaVencida(s, en(30).getTime())).toBe(true);
    expect(restanteMs(s, en(30).getTime())).toBe(0);
    const t = completar(s, en(30), BOGOTA);
    expect(t).toMatchObject({ estado: 'completada', finalizadaEn: en(25).toISOString(), minutosEfectivos: 25, vinculo: CALCULO, dia: '2026-11-16' });
  });

  it('no se completa antes de tiempo ni si está en pausa', () => {
    expect(() => completar(foco(), en(20), BOGOTA)).toThrow(expect.objectContaining({ clave: 'estudio.error.noTermino' }));
    const p = pausar(foco(), en(10));
    expect(() => completar(p, en(60), BOGOTA)).toThrow(expect.objectContaining({ clave: 'estudio.error.noTermino' }));
  });

  it('pausar 5 min a los 10 y reanudar: quedan 15 y termina 30 min después de empezar', () => {
    let s = pausar(foco(), en(10));
    expect(estaPausada(s)).toBe(true);
    expect(restanteMs(s, en(14).getTime())).toBe(15 * MIN); // en pausa no corre
    s = reanudar(s, en(15));
    expect(restanteMs(s, en(15).getTime())).toBe(15 * MIN);
    expect(finPrevistoMs(s, en(15).getTime())).toBe(en(30).getTime());
    expect(completar(s, en(31), BOGOTA)).toMatchObject({ finalizadaEn: en(30).toISOString(), minutosEfectivos: 25 });
    expect(() => pausar(pausar(foco(), en(1)), en(2))).toThrow(expect.objectContaining({ clave: 'estudio.error.estado' }));
    expect(() => reanudar(foco(), en(2))).toThrow(expect.objectContaining({ clave: 'estudio.error.estado' }));
  });

  it('cruzar la medianoche en Bogotá: cuenta para el día en que terminó, no el de la detección', () => {
    const lunes = iniciar({ id: 's2', fase: 'foco', duracionMin: 25, vinculo: null, ahora: new Date('2026-11-17T04:25:00Z') }); // lunes 23:25
    expect(completar(lunes, new Date('2026-11-17T05:10:00Z'), BOGOTA)).toMatchObject({ finalizadaEn: '2026-11-17T04:50:00.000Z', dia: '2026-11-16' });
    const cruza = iniciar({ id: 's3', fase: 'foco', duracionMin: 25, vinculo: null, ahora: new Date('2026-11-17T04:40:00Z') }); // lunes 23:40
    expect(completar(cruza, new Date('2026-11-17T05:10:00Z'), BOGOTA)).toMatchObject({ finalizadaEn: '2026-11-17T05:05:00.000Z', dia: '2026-11-17' });
  });
});

describe('E1 · fases, interrumpir y saltar', () => {
  it('interrumpir un foco guarda los minutos hechos (sin contar pausas)', () => {
    const s = reanudar(pausar(foco(), en(5)), en(8));
    expect(interrumpir(s, en(13), BOGOTA)).toMatchObject({ estado: 'interrumpida', minutosEfectivos: 10, finalizadaEn: en(13).toISOString() });
  });

  it('saltar solo aplica a descansos', () => {
    const d = iniciar({ id: 'd1', fase: 'corto', duracionMin: 5, vinculo: null, ahora: en(25) });
    expect(saltar(d, en(26), BOGOTA)).toMatchObject({ estado: 'saltada', fase: 'corto' });
    expect(() => saltar(foco(), en(1), BOGOTA)).toThrow(expect.objectContaining({ clave: 'estudio.error.estado' }));
  });

  it('ciclo 25/5/15 cada 4: corto tras cada foco y largo tras el 4.º; luego vuelve a empezar', () => {
    const cfg = CONFIGURACION_INICIAL;
    let ciclo = { focosEnCiclo: 0 };
    const fases: string[] = [];
    for (let i = 0; i < 4; i++) {
      const p = siguiente(cfg, ciclo, 'foco', 'completada');
      fases.push(`${p.fase}:${p.duracionMin}`);
      ciclo = p.ciclo;
      const q = siguiente(cfg, ciclo, p.fase, 'completada');
      expect(q.fase).toBe('foco');
      ciclo = q.ciclo;
    }
    expect(fases).toEqual(['corto:5', 'corto:5', 'corto:5', 'largo:15']);
    expect(ciclo.focosEnCiclo).toBe(0);
    // Un foco interrumpido no avanza el ciclo; saltar un descanso lleva al foco.
    expect(siguiente(cfg, { focosEnCiclo: 2 }, 'foco', 'interrumpida')).toMatchObject({ fase: 'foco', ciclo: { focosEnCiclo: 2 } });
    expect(siguiente(cfg, { focosEnCiclo: 2 }, 'corto', 'saltada')).toMatchObject({ fase: 'foco', duracionMin: 25 });
  });

  it('duración fuera de rango o vínculo mal formado se rechazan', () => {
    expect(() => foco({ duracionMin: 0 })).toThrow(expect.objectContaining({ clave: 'estudio.error.duracion' }));
    expect(() => foco({ vinculo: { tipo: 'x', id: '' } })).toThrow(expect.objectContaining({ clave: 'estudio.error.vinculo' }));
  });
});

describe('E2 · configuración', () => {
  it('guarda 50/10/20 cada 3', () => {
    expect(validarConfiguracion({ ...CONFIGURACION_INICIAL, focoMin: 50, cortoMin: 10, largoMin: 20, largoCada: 3 })).toMatchObject({ focoMin: 50, cortoMin: 10, largoMin: 20, largoCada: 3 });
  });
  it.each([
    ['focoMin', 0],
    ['focoMin', 200],
    ['focoMin', 25.5],
    ['cortoMin', 0],
    ['largoMin', 61],
    ['largoCada', 1],
    ['largoCada', 9],
  ] as const)('%s = %s fuera de rango', (campo, valor) => {
    expect(() => validarConfiguracion({ ...CONFIGURACION_INICIAL, [campo]: valor })).toThrow(expect.objectContaining({ campo, clave: `estudio.error.${campo}` }));
  });
});

describe('E4 · estadísticas por día local y por vínculo', () => {
  const t = (dia: string, min: number, vinculo: typeof CALCULO | null, estado: SesionTerminada['estado'] = 'completada', fase: SesionTerminada['fase'] = 'foco'): SesionTerminada => ({
    id: Math.random().toString(),
    fase,
    vinculo,
    duracionMin: min,
    iniciadaEn: `${dia}T14:00:00.000Z`,
    finalizadaEn: `${dia}T15:00:00.000Z`,
    estado,
    minutosEfectivos: min,
    dia,
  });
  const FISICA = { tipo: 'universidad.materia', id: 'm2' };
  it('4 de Cálculo y 2 de Física hoy = 2 h 30 min; semana lunes–domingo; descansos e interrumpidos no cuentan', () => {
    const sesiones = [
      ...Array.from({ length: 4 }, () => t('2026-11-18', 25, CALCULO)),
      ...Array.from({ length: 2 }, () => t('2026-11-18', 25, FISICA)),
      t('2026-11-16', 50, null),
      t('2026-11-18', 5, null, 'completada', 'corto'),
      t('2026-11-18', 10, CALCULO, 'interrumpida'),
      t('2026-11-15', 25, CALCULO), // domingo de la semana anterior
    ];
    const r = resumen(sesiones, '2026-11-18');
    expect(r.hoy).toEqual({ minutos: 150, pomodoros: 6, porVinculo: [{ vinculo: CALCULO, minutos: 100 }, { vinculo: FISICA, minutos: 50 }] });
    expect(r.semana.dias.map((d) => d.minutos)).toEqual([50, 0, 150, 0, 0, 0, 0]);
    expect(r.semana.dias[0]!.fecha).toBe('2026-11-16');
    expect(r.semana.minutos).toBe(200);
    expect(r.semana.porVinculo[2]).toEqual({ vinculo: null, minutos: 50 });
  });
  it('sin sesiones: todo en cero', () => {
    expect(resumen([], '2026-11-18')).toMatchObject({ hoy: { minutos: 0, pomodoros: 0, porVinculo: [] }, semana: { minutos: 0 } });
  });
});
