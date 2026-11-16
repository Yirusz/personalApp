/**
 * RPG de la iteración 6 contra IndexedDB en memoria con el bus real y reloj falso:
 * tramos (R1), racha por semanas cerradas (R2), logros (R3), canje (R4), avisos (R5)
 * y niveles de atributo (R6).
 */
import { describe, expect, it } from 'vitest';
import { definirModulo, type ContextoDeModulo } from '../../../nucleo/contrato';
import { crearFormatos, crearTraductor } from '../../../nucleo/i18n/traductor';
import { crearEntorno, type Entorno } from '../../../pruebas/entorno';
import rpg from '../modulo';
import textos from '../textos.es-CO.json';
import { ALMACEN_AVISOS, ALMACEN_LOGROS, ALMACEN_PERFIL, ALMACEN_REGISTRO, ALMACEN_SEMANAS, oroDisponible, type AsientoDeExperiencia, type AvisoPendiente, type Perfil, type SemanaEvaluada } from './almacenes';
import { anularCanje, archivarRecompensa, canjear, crearRecompensa } from './recompensas';
import { avisoAgrupado, pedirCierreDeSemanas } from './tareas';
import { REGLAS_DEL_RPG } from '../dominio/configuracion-activa';

/** Módulos de prueba que publican como lo harían Estudio y Universidad. */
const estudio = definirModulo({
  id: 'estudio',
  version: '1.0.0',
  nombre: 'estudio.nombre',
  textos: { 'estudio.nombre': 'Estudio' },
  rutas: [],
  migraciones: [{ version: 1, descripcion: 'x', aplicar: (c) => c.crearAlmacen('x') }],
  eventos: { 'estudio.PomodoroCompletado': { version: 1, descripcion: '' }, 'estudio.DescansoCompletado': { version: 1, descripcion: '' } },
});
const universidad = definirModulo({
  id: 'universidad',
  version: '1.0.0',
  nombre: 'universidad.nombre',
  textos: { 'universidad.nombre': 'Universidad' },
  rutas: [],
  migraciones: [{ version: 1, descripcion: 'x', aplicar: (c) => c.crearAlmacen('x') }],
  eventos: { 'universidad.TrabajoEntregado': { version: 1, descripcion: '' }, 'universidad.MateriaCreada': { version: 1, descripcion: '' } },
});

/** Mediodía local (Bogotá) de una fecha. */
const mediodia = (fecha: string) => new Date(`${fecha}T17:00:00Z`);

async function app(e?: Entorno) {
  e ??= await crearEntorno([rpg, estudio, universidad]);
  const contexto = (moduloId: string) =>
    ({ moduloId, almacen: e!.almacen.paraModulo(moduloId), reloj: e!.reloj, nuevoId: () => e!.ids.siguiente(), formatos: crearFormatos(), t: crearTraductor({ ...textos }) }) as unknown as ContextoDeModulo;
  for (const s of rpg.suscripciones!(contexto('rpg'))) e.bus.registrar('rpg', s);
  await e.bus.iniciar();
  const ctx = contexto('rpg');
  const publicar = async (modulo: string, tipo: string, datos: Record<string, unknown> = {}, ocurridoEn?: string) => {
    await e!.almacen.paraModulo(modulo).escribir(['x'], async (tx) => {
      tx.publicar(tipo, datos, ocurridoEn ? { ocurridoEn } : undefined);
    });
    await e!.bus.procesarPendientes();
  };
  /** Un Pomodoro publicado "ahora" o en una fecha (mediodía local). */
  const pomodoro = async (fecha?: string, ocurridoEn?: string) => {
    if (fecha) e!.reloj.fijar(mediodia(fecha));
    await publicar('estudio', 'estudio.PomodoroCompletado', { sesionId: e!.ids.siguiente(), minutosFoco: 25 }, ocurridoEn);
  };
  const leer = <T,>(almacen: string) => ctx.almacen.leer([almacen], (tx) => tx.listar<T>(almacen));
  const perfil = async () => (await ctx.almacen.leer([ALMACEN_PERFIL], (tx) => tx.obtener<Perfil>(ALMACEN_PERFIL, 'perfil')))!;
  const asientos = async (tipo?: string) => (await leer<AsientoDeExperiencia>(ALMACEN_REGISTRO)).filter((a) => !tipo || a.tipo === tipo);
  const semanas = () => leer<SemanaEvaluada>(ALMACEN_SEMANAS);
  const abrir = async () => {
    await pedirCierreDeSemanas(ctx);
    await e!.bus.procesarPendientes();
  };
  return { e, ctx, publicar, pomodoro, perfil, asientos, semanas, leer, abrir };
}

/** 4 días activos de la semana del lunes `lunes` (lun–jue). */
async function semanaCumplida(a: Awaited<ReturnType<typeof app>>, lunes: string) {
  const d = new Date(`${lunes}T00:00:00Z`);
  for (let i = 0; i < 4; i++) await a.pomodoro(new Date(d.getTime() + i * 86_400_000).toISOString().slice(0, 10));
}

describe('R1 · tramos con contadores por día', () => {
  it('13 Pomodoros el mismo día = 100 XP; el 13.º sin XP con "tramo reducido"', async () => {
    const a = await app();
    for (let i = 0; i < 13; i++) {
      a.e.reloj.fijar(new Date(Date.parse('2026-11-16T14:00:00Z') + i * 30 * 60_000));
      await a.pomodoro();
    }
    const xp = (await a.asientos('estudio.PomodoroCompletado')).map((x) => x.xp);
    expect(xp.reduce((n, x) => n + x, 0)).toBe(100);
    expect((await a.asientos('estudio.PomodoroCompletado')).at(-1)).toMatchObject({ xp: 0, nota: 'tramo-reducido' });
  });
});

describe('R2 · racha por semanas cerradas', () => {
  it('semana cumplida → +50 al cerrar (sin multiplicar), y la semana siguiente multiplica × 1,05', async () => {
    const a = await app();
    await semanaCumplida(a, '2026-11-16');
    expect(await a.semanas()).toEqual([]); // aún no cierra
    a.e.reloj.fijar(new Date('2026-11-23T05:00:00Z')); // lunes 00:00
    await a.abrir();
    expect(await a.semanas()).toMatchObject([{ lunes: '2026-11-16', semana: '2026-W47', diasActivos: 4, resultado: 'cumplida', despues: { semanas: 1 } }]);
    const bono = (await a.asientos('rpg.SemanaDeRachaCumplida'))[0]!;
    expect(bono).toMatchObject({ xp: 50, dia: '2026-11-22', ocurridoEn: '2026-11-23T04:59:59.999Z' });
    a.e.reloj.fijar(mediodia('2026-11-24'));
    await a.publicar('universidad', 'universidad.TrabajoEntregado', { trabajoId: 't1', tipo: 'taller', aTiempo: true, minutosDesdeCreacion: 60, peso: null });
    expect((await a.asientos('universidad.TrabajoEntregado'))[0]!.xp).toBe(25); // 24 × 1,05 = 25,2
    expect((await a.perfil()).racha.semanas).toBe(1);
  });

  it('3 semanas sin abrir: se evalúan en orden, usando el comodín; perder la racha no quita XP', async () => {
    const a = await app();
    for (const l of ['2026-11-02', '2026-11-09', '2026-11-16', '2026-11-23']) await semanaCumplida(a, l);
    a.e.reloj.fijar(new Date('2026-12-21T15:00:00Z')); // lunes 21 dic: cerraron 30 nov, 7 dic y 14 dic sin actividad
    const xpAntes = (await a.perfil()).xpTotal;
    await a.abrir();
    const s = await a.semanas();
    expect(s.map((x) => [x.lunes, x.resultado, x.despues.semanas, x.despues.comodines])).toEqual([
      ['2026-11-02', 'cumplida', 1, 0],
      ['2026-11-09', 'cumplida', 2, 0],
      ['2026-11-16', 'cumplida', 3, 0],
      ['2026-11-23', 'cumplida', 4, 1],
      ['2026-11-30', 'comodin', 4, 0],
      ['2026-12-07', 'perdida', 0, 0],
      ['2026-12-14', 'sin-racha', 0, 0],
    ]);
    expect((await a.perfil()).xpTotal).toBeGreaterThanOrEqual(xpAntes); // nunca baja
    expect((await a.leer<{ id: string }>(ALMACEN_LOGROS)).map((l) => l.id)).toContain('constancia');
  });

  it('sin gracia: un Pomodoro del domingo 23:50 registrado el lunes 00:10 da XP el domingo pero no cuenta para la racha', async () => {
    const a = await app();
    for (const f of ['2026-11-16', '2026-11-17', '2026-11-18']) await a.pomodoro(f);
    a.e.reloj.fijar(new Date('2026-11-23T05:10:00Z')); // lunes 00:10
    await a.pomodoro(undefined, '2026-11-23T04:50:00Z'); // domingo 23:50
    expect((await a.asientos('estudio.PomodoroCompletado')).at(-1)).toMatchObject({ dia: '2026-11-22', xp: 10 });
    expect((await a.semanas())[0]).toMatchObject({ diasActivos: 3, resultado: 'sin-racha' });
  });

  it('domingo 23:59 registrado a tiempo sí cuenta; la semana 53 de 2026 se evalúa normal', async () => {
    const a = await app();
    for (const f of ['2026-11-16', '2026-11-17', '2026-11-18']) await a.pomodoro(f);
    a.e.reloj.fijar(new Date('2026-11-23T04:59:00Z')); // domingo 23:59
    await a.pomodoro();
    for (const f of ['2026-12-28', '2026-12-30', '2027-01-01', '2027-01-03']) await a.pomodoro(f);
    a.e.reloj.fijar(new Date('2027-01-04T05:00:00Z'));
    await a.abrir();
    const s = await a.semanas();
    expect(s[0]).toMatchObject({ semana: '2026-W47', resultado: 'cumplida' });
    expect(s.at(-1)).toMatchObject({ lunes: '2026-12-28', semana: '2026-W53', diasActivos: 4, resultado: 'cumplida' });
  });

  it('determinista: evaluar el martes o tres semanas después da lo mismo', async () => {
    const pronto = await app();
    const tarde = await app();
    for (const x of [pronto, tarde]) await semanaCumplida(x, '2026-11-16');
    pronto.e.reloj.fijar(new Date('2026-11-24T15:00:00Z'));
    await pronto.abrir();
    tarde.e.reloj.fijar(new Date('2026-12-15T15:00:00Z'));
    await tarde.abrir();
    const primera = (s: SemanaEvaluada[]) => s.find((x) => x.lunes === '2026-11-16');
    expect(primera(await tarde.semanas())).toEqual(primera(await pronto.semanas()));
  });

  it('un evento atrasado usa la racha que regía en su semana', async () => {
    const a = await app();
    await semanaCumplida(a, '2026-11-09');
    await semanaCumplida(a, '2026-11-16'); // al cerrar la del 9, racha 1; al cerrar la del 16, racha 2
    a.e.reloj.fijar(new Date('2026-11-24T15:00:00Z'));
    await a.abrir();
    // Trabajo entregado el viernes 20 (semana con racha 1) pero registrado el martes 24.
    await a.publicar('universidad', 'universidad.TrabajoEntregado', { trabajoId: 't9', tipo: 'taller', aTiempo: true, minutosDesdeCreacion: 60, peso: null }, '2026-11-20T17:00:00Z');
    expect((await a.asientos('universidad.TrabajoEntregado'))[0]!.xp).toBe(25); // × 1,05, no × 1,10
  });
});

describe('R3 · logros y R5 · avisos', () => {
  it('primer foco (+10 XP una vez), puntual con 10 trabajos distintos (reabrir no suma), avisos agrupados', async () => {
    const a = await app();
    await a.pomodoro('2026-11-16');
    await a.pomodoro('2026-11-16');
    expect((await a.asientos('rpg.LogroDesbloqueado')).map((x) => x.xp)).toEqual([10]);
    for (let i = 0; i < 9; i++) await a.publicar('universidad', 'universidad.TrabajoEntregado', { trabajoId: `t${i}`, tipo: 'tarea', aTiempo: true, minutosDesdeCreacion: 60 });
    await a.publicar('universidad', 'universidad.TrabajoEntregado', { trabajoId: 't0', tipo: 'tarea', aTiempo: true, minutosDesdeCreacion: 60 }); // reentrega
    await a.publicar('universidad', 'universidad.TrabajoEntregado', { trabajoId: 't8', tipo: 'tarea', aTiempo: false, minutosDesdeCreacion: 60 });
    expect((await a.leer<{ id: string }>(ALMACEN_LOGROS)).map((l) => l.id)).toEqual(['primer-foco']);
    await a.publicar('universidad', 'universidad.TrabajoEntregado', { trabajoId: 't10', tipo: 'tarea', aTiempo: true, minutosDesdeCreacion: 60 });
    expect((await a.leer<{ id: string }>(ALMACEN_LOGROS)).map((l) => l.id).sort()).toEqual(['primer-foco', 'puntual']);
    const avisos = await a.leer<AvisoPendiente>(ALMACEN_AVISOS);
    const t = crearTraductor({ ...textos });
    expect(avisoAgrupado(t, avisos.filter((x) => x.tipo === 'logro'))).toMatchObject({ titulo: '2 logros: Primer foco y Puntual' });
    expect(avisoAgrupado(t, avisos)).toMatchObject({ titulo: expect.stringMatching(/^¡Nivel \d+!$/) });
  });

  it('relleno inicial desde el libro (datos de la 0.6): contadores, primera semana y logros ya cumplidos', async () => {
    const e = await crearEntorno([rpg, estudio, universidad]);
    // Asientos "viejos" escritos sin contadores (como los dejaba la versión anterior).
    await e.almacen.paraModulo('rpg').escribir([ALMACEN_REGISTRO, ALMACEN_PERFIL], async (tx) => {
      for (let i = 0; i < 5; i++) {
        const id = e.ids.siguiente();
        await tx.poner(ALMACEN_REGISTRO, { id, tipo: 'estudio.PomodoroCompletado', dia: '2026-11-14', ocurridoEn: '2026-11-14T15:00:00.000Z', xpBase: 10, xp: 10, atributo: 'intelecto' });
      }
      await tx.poner(ALMACEN_PERFIL, { id: 'perfil', xpTotal: 50, oroGastado: 0, atributos: { intelecto: 50 }, nivel: 1, actualizadoEn: '2026-11-14T15:00:00.000Z' });
    });
    const a = await app(e);
    a.e.reloj.fijar(new Date('2026-11-14T16:00:00Z'));
    await a.pomodoro(); // el 6.º del día
    expect((await a.asientos('estudio.PomodoroCompletado')).at(-1)!.xp).toBe(10);
    expect((await a.leer<{ id: string }>(ALMACEN_LOGROS)).map((l) => l.id)).toEqual(['primer-foco']);
    expect((await a.perfil()).racha.primerLunes).toBe('2026-11-09');
  });
});

describe('R6 · niveles de atributo', () => {
  it('Intelecto llega a 100 XP → nivel 2 y aviso', async () => {
    const a = await app();
    for (let i = 0; i < 9; i++) {
      a.e.reloj.fijar(new Date(Date.parse('2026-11-16T14:00:00Z') + i * 30 * 60_000));
      await a.pomodoro();
    }
    const p = await a.perfil();
    expect(p.atributos.intelecto).toBe(85); // 8 × 10 + 5 (tramo)
    expect(p.nivelesDeAtributo.intelecto).toBe(2);
    expect((await a.leer<AvisoPendiente>(ALMACEN_AVISOS)).some((x) => x.tipo === 'atributo' && x.nivel === 2)).toBe(true);
  });
});

describe('R4 · recompensas y canje', () => {
  it('canjear 30 descuenta 30; sin oro suficiente no deja canjear; deshacer devuelve; archivada no se canjea', async () => {
    const a = await app();
    for (let i = 0; i < 5; i++) {
      a.e.reloj.fijar(new Date(Date.parse('2026-11-16T14:00:00Z') + i * 30 * 60_000));
      await a.pomodoro();
    }
    // Más XP para tener al menos 30 de oro:
    for (let i = 0; i < 25; i++) await a.publicar('universidad', 'universidad.TrabajoEntregado', { trabajoId: `p${i}`, tipo: 'proyecto', aTiempo: false, minutosDesdeCreacion: 60 });
    const oro = async () => oroDisponible(await a.perfil(), REGLAS_DEL_RPG);
    const antes = await oro();
    expect(antes).toBeGreaterThanOrEqual(30);
    const serie = await crearRecompensa(a.ctx, { nombre: ' Serie ', costo: 30 });
    const canje = await canjear(a.ctx, serie.id);
    await a.e.bus.procesarPendientes();
    expect(await oro()).toBe(antes - 30);
    const cara = await crearRecompensa(a.ctx, { nombre: 'Viaje', costo: 99_999 });
    await expect(canjear(a.ctx, cara.id)).rejects.toMatchObject({ clave: 'rpg.error.oroInsuficiente', parametros: { falta: 99_999 - (antes - 30) } });
    await anularCanje(a.ctx, canje);
    await anularCanje(a.ctx, canje); // idempotente
    await a.e.bus.procesarPendientes();
    expect(await oro()).toBe(antes);
    await archivarRecompensa(a.ctx, serie.id);
    await expect(canjear(a.ctx, serie.id)).rejects.toMatchObject({ clave: 'rpg.error.recompensaNoExiste' });
    await expect(crearRecompensa(a.ctx, { nombre: 'x', costo: 0 })).rejects.toMatchObject({ campo: 'costo' });
    // Los canjes no dan XP ni se procesan dos veces.
    expect((await a.asientos('rpg.RecompensaCanjeada')).map((x) => [x.xp, x.oro, x.anulado])).toEqual([[0, 30, true]]);
  });
});
