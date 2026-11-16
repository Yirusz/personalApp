/**
 * Casos de uso de Estudio contra IndexedDB en memoria, con reloj falso (E1, E2, E5).
 * Todo es local: los escenarios "sin conexión" se cumplen porque nada usa la red.
 */
import { avisadorNulo } from '../../../nucleo/infraestructura/avisos';
import { describe, expect, it, vi } from 'vitest';
import type { ContextoDeModulo } from '../../../nucleo/contrato';
import { integracionesVacias } from '../../../nucleo/aplicacion/integraciones';
import type { EventoDeDominio } from '../../../nucleo/dominio/evento';
import { crearFormatos, crearTraductor } from '../../../nucleo/i18n/traductor';
import { crearEntorno, type Entorno } from '../../../pruebas/entorno';
import { CONFIGURACION_INICIAL } from '../dominio/configuracion';
import { MIGRACIONES } from '../infraestructura/migraciones';
import textos from '../textos.es-CO.json';
import { DECLARACIONES, ESTADO, leerEstado, type ContextoDeCasoDeUso } from './comun';
import { leerPantalla } from './consultas';
import { cambiarVinculo, detener, guardarConfiguracion, iniciarFase, pausar, reanudar, revisar } from './pomodoro';
import { crearProveedores, ID_FICHA, ID_FUENTE } from './proveedores';
import { debeAvisar, iniciarTemporizador, textoRestante } from './temporizador';

const ESQUEMA = { id: 'estudio', migraciones: MIGRACIONES, eventos: DECLARACIONES };
const MIN = 60_000;
const CALCULO = { tipo: 'universidad.materia', id: 'm1' };

async function preparar(e?: Entorno) {
  e ??= await crearEntorno([ESQUEMA]); // reloj: sábado 2026-11-14 10:00 en Bogotá
  const eventos: EventoDeDominio[] = [];
  e.almacen.alPublicar((evs) => eventos.push(...evs));
  const ctx: ContextoDeCasoDeUso = { almacen: e.almacen.paraModulo('estudio'), reloj: e.reloj, nuevoId: () => e.ids.siguiente() };
  const tipos = () => eventos.map((x) => x.tipo.replace('estudio.', ''));
  const estado = () => ctx.almacen.leer([ESTADO], leerEstado);
  return { e, ctx, eventos, tipos, estado };
}

describe('E5 · resistente a congelamiento', () => {
  it('congelar 30 min: se completa a los 25 exactos y PomodoroCompletado sale una vez, con ocurridoEn = fin real', async () => {
    const { e, ctx, eventos, tipos, estado } = await preparar();
    const s = await iniciarFase(ctx, { vinculo: CALCULO });
    expect(s).toMatchObject({ fase: 'foco', duracionMin: 25 });
    e.reloj.avanzar(10 * MIN);
    expect(await revisar(ctx)).toBeNull(); // aún no
    e.reloj.avanzar(20 * MIN); // vuelve a los 30
    const t = await revisar(ctx);
    expect(t).toMatchObject({ estado: 'completada', finalizadaEn: '2026-11-14T15:25:00.000Z', minutosEfectivos: 25 });
    expect(await revisar(ctx)).toBeNull();
    expect(tipos()).toEqual(['PomodoroCompletado']);
    expect(eventos[0]).toMatchObject({ ocurridoEn: '2026-11-14T15:25:00.000Z', datos: { sesionId: s.id, vinculo: CALCULO, minutosFoco: 25 } });
    expect(await estado()).toMatchObject({ activa: null, ciclo: { focosEnCiclo: 1, proxima: 'corto', ultima: { fase: 'foco', estado: 'completada' } } });
    expect(debeAvisar(t!, e.reloj.ahora().getTime())).toBe(false); // 5 min tarde: no suena al volver
  });

  it('recargar a mitad: el estado se reconstruye y el restante es correcto', async () => {
    const { e, ctx } = await preparar();
    await iniciarFase(ctx, { vinculo: null });
    e.reloj.avanzar(7 * MIN);
    const nuevo = await e.reabrir();
    const { estado, ctx: ctx2 } = await preparar(nuevo);
    const { activa } = await estado();
    expect(activa).not.toBeNull();
    const { restanteMs } = await import('../dominio/sesion');
    expect(textoRestante(restanteMs(activa!, nuevo.reloj.ahora().getTime()))).toBe('18:00');
    nuevo.reloj.avanzar(18 * MIN);
    expect(await revisar(ctx2)).toMatchObject({ estado: 'completada' });
  });

  it('dos pestañas que revisan a la vez: solo una completa', async () => {
    const { e, ctx, tipos } = await preparar();
    const pestana2: ContextoDeCasoDeUso = { almacen: e.almacen.paraModulo('estudio'), reloj: e.reloj, nuevoId: () => e.ids.siguiente() };
    await iniciarFase(ctx, { vinculo: null });
    e.reloj.avanzar(26 * MIN);
    const [a, b] = await Promise.all([revisar(ctx), revisar(pestana2)]);
    expect([a, b].filter(Boolean)).toHaveLength(1);
    expect(tipos()).toEqual(['PomodoroCompletado']);
  });

  it('cruzar la medianoche de Bogotá: termina 23:50, se detecta 00:10 → cuenta para el día anterior', async () => {
    const { e, ctx, eventos } = await preparar();
    e.reloj.fijar(new Date('2026-11-17T04:25:00Z')); // lunes 23:25 local
    await iniciarFase(ctx, { vinculo: null });
    e.reloj.fijar(new Date('2026-11-17T05:10:00Z')); // vuelve el martes a las 00:10
    expect(await revisar(ctx)).toMatchObject({ dia: '2026-11-16' });
    expect(eventos[0]!.ocurridoEn).toBe('2026-11-17T04:50:00.000Z');
  });
});

describe('E1 · fases', () => {
  it('ciclo: foco → corto propuesto → DescansoCompletado; saltar no publica', async () => {
    const { e, ctx, tipos, estado } = await preparar();
    await iniciarFase(ctx, { vinculo: null });
    e.reloj.avanzar(25 * MIN);
    await revisar(ctx);
    const d = await iniciarFase(ctx, { vinculo: CALCULO });
    expect(d).toMatchObject({ fase: 'corto', duracionMin: 5, vinculo: null }); // los descansos no llevan vínculo
    e.reloj.avanzar(5 * MIN);
    await revisar(ctx);
    expect((await estado()).ciclo.proxima).toBe('foco');
    await iniciarFase(ctx, { vinculo: null });
    e.reloj.avanzar(25 * MIN);
    await revisar(ctx);
    await iniciarFase(ctx, { vinculo: null });
    e.reloj.avanzar(1 * MIN);
    expect(await detener(ctx)).toMatchObject({ estado: 'saltada' });
    expect(tipos()).toEqual(['PomodoroCompletado', 'DescansoCompletado', 'PomodoroCompletado']);
  });

  it('detener un foco antes de tiempo publica PomodoroInterrumpido y no avanza el ciclo', async () => {
    const { e, ctx, eventos, estado } = await preparar();
    await iniciarFase(ctx, { vinculo: CALCULO });
    e.reloj.avanzar(10 * MIN);
    await detener(ctx);
    expect(eventos.map((x) => [x.tipo, x.datos])).toEqual([['estudio.PomodoroInterrumpido', expect.objectContaining({ vinculo: CALCULO, minutosFoco: 10 })]]);
    expect((await estado()).ciclo).toMatchObject({ focosEnCiclo: 0, proxima: 'foco' });
  });

  it('una sola sesión activa; pausar y reanudar mueven el fin; cambiar el vínculo en curso', async () => {
    const { e, ctx, estado } = await preparar();
    await iniciarFase(ctx, { vinculo: null });
    await expect(iniciarFase(ctx, { vinculo: null })).rejects.toMatchObject({ clave: 'estudio.error.enCurso' });
    e.reloj.avanzar(10 * MIN);
    await pausar(ctx);
    e.reloj.avanzar(5 * MIN);
    await reanudar(ctx);
    await cambiarVinculo(ctx, CALCULO);
    e.reloj.avanzar(14 * MIN);
    expect(await revisar(ctx)).toBeNull(); // 29 min: falta 1 por la pausa
    e.reloj.avanzar(1 * MIN);
    expect(await revisar(ctx)).toMatchObject({ vinculo: CALCULO, minutosEfectivos: 25 });
    expect((await estado()).activa).toBeNull();
    await expect(pausar(ctx)).rejects.toMatchObject({ clave: 'estudio.error.sinSesion' });
  });
});

describe('E2 · configuración', () => {
  it('se guarda y aplica desde la próxima fase; la sesión en curso no cambia; fuera de rango no se guarda', async () => {
    const { e, ctx, estado } = await preparar();
    const s = await iniciarFase(ctx, { vinculo: null });
    await guardarConfiguracion(ctx, { ...CONFIGURACION_INICIAL, focoMin: 50, cortoMin: 10, largoMin: 20, largoCada: 3 });
    expect((await estado()).activa!.duracionMin).toBe(25);
    await expect(guardarConfiguracion(ctx, { ...CONFIGURACION_INICIAL, focoMin: 200 })).rejects.toMatchObject({ campo: 'focoMin' });
    e.reloj.avanzar(25 * MIN);
    await revisar(ctx);
    expect(await iniciarFase(ctx, { vinculo: null })).toMatchObject({ fase: 'corto', duracionMin: 10 });
    expect(s.duracionMin).toBe(25);
    expect((await estado()).configuracion).toMatchObject({ focoMin: 50, largoCada: 3 });
  });
});

describe('E4 · estadísticas por índice de día', () => {
  it('suma los focos completados de hoy y de la semana', async () => {
    const { e, ctx } = await preparar();
    for (let i = 0; i < 3; i++) {
      await iniciarFase(ctx, { vinculo: CALCULO, fase: 'foco' });
      e.reloj.avanzar(25 * MIN);
      await revisar(ctx);
    }
    const p = await ctx.almacen.leer(['estado', 'sesiones'], (tx) => leerPantalla(tx, '2026-11-14'));
    expect(p.resumen.hoy).toMatchObject({ minutos: 75, pomodoros: 3, porVinculo: [{ vinculo: CALCULO, minutos: 75 }] });
    expect(p.resumen.semana.dias.map((d) => d.minutos)).toEqual([0, 0, 0, 0, 0, 75, 0]);
  });
});

describe('Integración: calendario y fichas (ADR-0013/0015)', () => {
  it('la fuente da los focos completados con el nombre de la materia; si Universidad falla, título genérico', async () => {
    const { e, ctx } = await preparar();
    await iniciarFase(ctx, { vinculo: CALCULO });
    e.reloj.avanzar(25 * MIN);
    await revisar(ctx);
    await iniciarFase(ctx, { vinculo: null });
    e.reloj.avanzar(3 * MIN);
    await detener(ctx); // interrumpido: no sale en el calendario
    const buscar = vi.fn(async () => ({ referencias: [{ tipo: 'universidad.materia', id: 'm1', titulo: 'Cálculo II', color: 'verde' as const, activa: true }], fallos: [] }));
    const completo = { ...ctx, t: crearTraductor({ ...textos }), formatos: crearFormatos(), integraciones: { ...integracionesVacias, buscarReferencias: buscar } } as unknown as ContextoDeModulo;
    const fuente = crearProveedores(completo).fuentesDeCalendario![0]!;
    expect(fuente.id).toBe(ID_FUENTE);
    const rango = { desde: '2026-11-14T05:00:00Z', hasta: '2026-11-15T05:00:00Z' };
    expect(await fuente.elementos(rango)).toEqual([
      { id: expect.any(String), titulo: 'Estudio: Cálculo II', inicio: '2026-11-14T15:00:00.000Z', fin: '2026-11-14T15:25:00.000Z', tipo: 'bloque', estado: 'hecho', color: 'verde', ruta: '/estudio' },
    ]);
    buscar.mockRejectedValueOnce(new Error('caída'));
    expect((await fuente.elementos(rango))[0]).toMatchObject({ titulo: 'Estudio (Pomodoro)', color: 'morado' });
    expect(await crearProveedores(completo).fichas!.fichas()).toEqual([expect.objectContaining({ id: ID_FICHA, titulo: 'Bloque de estudio', duracionMin: 120, repeticion: { tipo: 'unica' } })]);
  });
});

describe('alIniciar: temporizador y aviso (E3)', () => {
  it('completa al vencer y avisa una vez (notificación)', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
    try {
      const { e, ctx, tipos } = await preparar();
      const mostrar = vi.fn(async () => true);
      const completo = {
        ...ctx,
        moduloId: 'estudio',
        t: crearTraductor({ ...textos }),
        formatos: crearFormatos(),
        diagnostico: e.diagnostico,
        notificaciones: { permiso: () => 'concedido', pedirPermiso: async () => 'concedido', mostrar },
        integraciones: integracionesVacias,
        avisos: avisadorNulo,
        navegar: () => undefined,
      } as unknown as ContextoDeModulo;
      await iniciarFase(ctx, { vinculo: null });
      const parar = iniciarTemporizador(completo);
      await vi.advanceTimersByTimeAsync(100);
      e.reloj.avanzar(25 * MIN);
      await vi.advanceTimersByTimeAsync(25 * MIN + 100);
      expect(tipos()).toEqual(['PomodoroCompletado']);
      expect(mostrar).toHaveBeenCalledTimes(1);
      expect(mostrar).toHaveBeenCalledWith(expect.objectContaining({ titulo: 'Foco terminado' }));
      parar(); // sin DOM en las pruebas: el título se revisa en el recorrido del navegador
    } finally {
      vi.useRealTimers();
    }
  });
});
