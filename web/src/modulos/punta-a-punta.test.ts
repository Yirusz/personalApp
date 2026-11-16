/**
 * Pruebas de punta a punta del contrato de módulos: un módulo guarda y publica
 * eventos; el RPG (que ese módulo no conoce) los convierte en experiencia según
 * reglas.v1.json. Viven fuera de las carpetas de los módulos porque cruzan varios.
 */
import { describe, expect, it } from 'vitest';
import type { ContextoDeModulo } from '../nucleo/contrato';
import { crearFormatos, crearTraductor } from '../nucleo/i18n/traductor';
import { crearEntorno, type Entorno } from '../pruebas/entorno';
import { registrar } from './ejemplo/aplicacion/registrar';
import { RegistroInvalido } from './ejemplo/dominio/registro';
import ejemplo from './ejemplo/modulo';
import { leerPerfil, leerUltimosAsientos } from './rpg/aplicacion/registrar-experiencia';
import { notificadorNulo } from '../nucleo/infraestructura/notificaciones';
import rpg from './rpg/modulo';
import { crearMateria } from './universidad/aplicacion/materias';
import { agregarSubtarea, calificarTrabajo, entregarTrabajo, reabrirTrabajo, registrarTrabajo } from './universidad/aplicacion/trabajos';
import { crearIntegraciones, integracionesVacias } from '../nucleo/aplicacion/integraciones';
import universidad from './universidad/modulo';
import calendario from './calendario/modulo';
import estudio from './estudio/modulo';
import { iniciarFase, revisar } from './estudio/aplicacion/pomodoro';
import { combinar, leerFuentes, leerFuentesRegistradas, visiblesEnRango } from './calendario/aplicacion/fuentes';
import { zonaDelUsuario } from './calendario/aplicacion/comun';

const formatos = crearFormatos();

function contexto(e: Entorno, moduloId: string): ContextoDeModulo {
  return {
    moduloId,
    almacen: e.almacen.paraModulo(moduloId),
    reloj: e.reloj,
    nuevoId: () => e.ids.siguiente(),
    t: crearTraductor({}),
    formatos,
    diagnostico: e.diagnostico,
    notificaciones: notificadorNulo,
    integraciones: integracionesVacias,
    navegar: () => undefined,
  };
}

async function app() {
  const e = await crearEntorno([ejemplo, rpg]);
  for (const s of rpg.suscripciones!(contexto(e, 'rpg'))) e.bus.registrar('rpg', s);
  await e.bus.iniciar();
  return { e, ctxEjemplo: contexto(e, 'ejemplo'), rpgAlmacen: e.almacen.paraModulo('rpg') };
}

describe('contrato de punta a punta: ejemplo → evento → RPG', () => {
  it('un registro del ejemplo otorga experiencia en el RPG', async () => {
    const { e, ctxEjemplo, rpgAlmacen } = await app();
    await registrar(ctxEjemplo, 'Primera prueba');
    await e.bus.procesarPendientes();

    const perfil = await rpgAlmacen.leer(['perfil'], leerPerfil);
    expect(perfil).toMatchObject({ xpTotal: 1, nivel: 1, atributos: { disciplina: 1 } });
    const [asiento] = await rpgAlmacen.leer(['registro'], (tx) => leerUltimosAsientos(tx));
    expect(asiento).toMatchObject({ tipo: 'ejemplo.RegistroCreado', xp: 1, dia: '2026-11-14' });
  });

  it('respeta el límite diario (5 XP) y lo reinicia al día siguiente en hora de Bogotá', async () => {
    const { e, ctxEjemplo, rpgAlmacen } = await app();
    for (let i = 0; i < 7; i++) await registrar(ctxEjemplo, `r${i}`);
    await e.bus.procesarPendientes();
    expect((await rpgAlmacen.leer(['perfil'], leerPerfil))?.xpTotal).toBe(5);

    // 2026-11-15T04:59Z = 23:59 del 14 en Bogotá → todavía el mismo día.
    e.reloj.fijar('2026-11-15T04:59:00Z');
    await registrar(ctxEjemplo, 'tarde');
    await e.bus.procesarPendientes();
    expect((await rpgAlmacen.leer(['perfil'], leerPerfil))?.xpTotal).toBe(5);

    e.reloj.fijar('2026-11-15T05:00:00Z'); // 00:00 del 15 en Bogotá
    await registrar(ctxEjemplo, 'nuevo día');
    await e.bus.procesarPendientes();
    expect((await rpgAlmacen.leer(['perfil'], leerPerfil))?.xpTotal).toBe(6);
  });

  it('reprocesar no duplica experiencia (idempotente)', async () => {
    const { e, ctxEjemplo, rpgAlmacen } = await app();
    await registrar(ctxEjemplo, 'una vez');
    await e.bus.procesarPendientes();
    const e2 = await e.reabrir();
    for (const s of rpg.suscripciones!(contexto(e2, 'rpg'))) e2.bus.registrar('rpg', s);
    await e2.bus.iniciar();
    expect((await e2.almacen.paraModulo('rpg').leer(['perfil'], leerPerfil))?.xpTotal).toBe(1);
    expect(rpgAlmacen).toBeDefined();
  });

  it('una regla del dominio del ejemplo impide guardar y no se publica nada', async () => {
    const { e, ctxEjemplo } = await app();
    await expect(registrar(ctxEjemplo, 'x'.repeat(141))).rejects.toThrow(RegistroInvalido);
    expect(await e.almacen.contarTodo()).toMatchObject({ ejemplo_registros: 0, nucleo_eventos: 0 });
  });
});

describe('Universidad → eventos → RPG (XP por tipo, ADR-0014)', () => {
  const HORA = 3_600_000;

  async function appUniversidad() {
    const e = await crearEntorno([universidad, rpg]);
    for (const s of rpg.suscripciones!(contexto(e, 'rpg'))) e.bus.registrar('rpg', s);
    await e.bus.iniciar();
    const ctx = contexto(e, 'universidad');
    const perfil = async () => {
      await e.bus.procesarPendientes();
      return (await e.almacen.paraModulo('rpg').leer(['perfil'], leerPerfil))!.xpTotal;
    };
    const materia = await crearMateria(ctx, { nombre: 'Física I', profesor: '', color: 'azul', periodo: '2026-2', creditos: null });
    const registrar = (venceEnHoras: number, tipo: 'tarea' | 'parcial' | 'proyecto' = 'parcial', peso: number | null = null) =>
      registrarTrabajo(ctx, { materiaId: materia.id, titulo: 'Trabajo', tipo, descripcion: '', venceEn: new Date(e.reloj.ahora().getTime() + venceEnHoras * HORA).toISOString(), prioridad: 'media', peso });
    return { e, ctx, perfil, registrar };
  }

  it('materia (5) + registrar con 72 h (3) + parcial a tiempo con peso 25 % (50 × 1,2 × 1,25 = 75) + nota (5) = 88 XP', async () => {
    const { e, ctx, perfil, registrar } = await appUniversidad();
    const t = await registrar(72, 'parcial', 250);
    e.reloj.avanzar(HORA);
    await entregarTrabajo(ctx, t.id);
    await calificarTrabajo(ctx, t.id, 42);
    expect(await perfil()).toBe(88);
  });

  it('reabrir y volver a entregar no da doble premio; corregir la nota tampoco', async () => {
    const { e, ctx, perfil, registrar } = await appUniversidad();
    const t = await registrar(24, 'tarea'); // < 48 h: registrar no da XP
    e.reloj.avanzar(HORA);
    await entregarTrabajo(ctx, t.id);
    await calificarTrabajo(ctx, t.id, 30);
    const antes = await perfil();
    await calificarTrabajo(ctx, t.id, 35);
    await reabrirTrabajo(ctx, t.id);
    await entregarTrabajo(ctx, t.id);
    expect(await perfil()).toBe(antes);
  });

  it('entregar 5 min después de crearlo no da XP; las subtareas nunca dan XP', async () => {
    const { e, ctx, perfil, registrar } = await appUniversidad();
    const t = await registrar(10, 'proyecto');
    for (let i = 0; i < 5; i++) await agregarSubtarea(ctx, t.id, `paso ${i}`);
    e.reloj.avanzar(5 * 60_000);
    await entregarTrabajo(ctx, t.id);
    expect(await perfil()).toBe(5); // solo la materia
  });
});

describe('Universidad → fuente registrada → Calendario (por consulta, sin conocerse)', () => {
  it('las entregas aparecen con color y ruta, se marcan hechas al entregar, y la copia vieja por eventos no se duplica', async () => {
    const e = await crearEntorno([universidad, calendario]);
    const integraciones = crearIntegraciones([universidad, calendario], (id) => contexto(e, id));
    const u = contexto(e, 'universidad');
    const materia = await crearMateria(u, { nombre: 'Física I', profesor: '', color: 'verde', periodo: '2026-2', creditos: null });
    const t = await registrarTrabajo(u, { materiaId: materia.id, titulo: 'Taller 3', tipo: 'taller', descripcion: '', venceEn: '2026-11-21T04:59:00Z', prioridad: 'alta', peso: null });
    // Copia "vieja" en la proyección (como la publicaba la iteración 1 con datos.agenda).
    await e.almacen.paraModulo('calendario').escribir(['agenda'], (tx) => tx.poner('agenda', { clave: `universidad:${t.id}`, origen: 'universidad', agenda: { id: t.id, titulo: 'Taller 3', inicio: t.venceEn, tipo: 'vencimiento', estado: 'pendiente' }, actualizadoEn: t.creadoEn }));
    const rango = { desdeMs: Date.parse('2026-11-16T05:00:00Z'), hastaMs: Date.parse('2026-11-23T05:00:00Z') };
    const zona = zonaDelUsuario();
    const ver = async () => {
      const r = await leerFuentesRegistradas(integraciones, rango, zona);
      return combinar(visiblesEnRango(await leerFuentes(e.almacen.paraModulo('calendario')), rango, zona, r.origenes), r).elementos;
    };
    expect(await ver()).toMatchObject([{ fuente: 'externo', origen: 'universidad', titulo: 'Taller 3', color: 'verde', fechaInicio: '2026-11-20', hecho: false, ruta: `/universidad/trabajos/${t.id}` }]);
    await entregarTrabajo(u, t.id);
    expect(await ver()).toMatchObject([{ hecho: true }]);
  });

  it('Estudio/Notas pueden buscar materias y trabajos sin importar Universidad', async () => {
    const e = await crearEntorno([universidad, calendario]);
    const integraciones = crearIntegraciones([universidad, calendario], (id) => contexto(e, id));
    await crearMateria(contexto(e, 'universidad'), { nombre: 'Cálculo II', profesor: '', color: 'azul', periodo: '2026-2', creditos: null });
    expect(integraciones.tiposDeReferencia()).toEqual(['universidad.materia', 'universidad.trabajo']);
    expect((await integraciones.buscarReferencias({ tipo: 'universidad.materia', texto: 'calc' })).referencias.map((r) => r.titulo)).toEqual(['Cálculo II']);
  });
});

describe('Estudio → eventos → RPG (tope provisional y día real, ADR-0016)', () => {
  const MIN = 60_000;
  async function app() {
    const e = await crearEntorno([estudio, rpg, calendario, universidad]);
    for (const s of rpg.suscripciones!(contexto(e, 'rpg'))) e.bus.registrar('rpg', s);
    await e.bus.iniciar();
    const ctx = contexto(e, 'estudio');
    const pomodoro = async () => {
      await iniciarFase(ctx, { vinculo: null, fase: 'foco' });
      e.reloj.avanzar(25 * MIN);
      await revisar(ctx);
    };
    const asientos = async () => {
      await e.bus.procesarPendientes();
      return e.almacen.paraModulo('rpg').leer(['registro'], (tx) => leerUltimosAsientos(tx, 50));
    };
    return { e, ctx, pomodoro, asientos };
  }

  it('10 XP por Pomodoro con tope de 80 al día (los tramos llegan en la iteración 6)', async () => {
    const { pomodoro, asientos } = await app();
    for (let i = 0; i < 9; i++) await pomodoro();
    const xp = (await asientos()).filter((a) => a.tipo === 'estudio.PomodoroCompletado').map((a) => a.xp);
    expect(xp.reduce((n, x) => n + x, 0)).toBe(80);
    expect(xp).toContain(0);
  });

  it('termina a las 23:50 con Android congelado y se detecta a las 00:10: la XP es del día anterior', async () => {
    const { e, ctx, asientos } = await app();
    e.reloj.fijar(new Date('2026-11-17T04:25:00Z')); // lunes 16, 23:25 en Bogotá
    await iniciarFase(ctx, { vinculo: null });
    e.reloj.fijar(new Date('2026-11-17T05:10:00Z')); // martes 17, 00:10
    await revisar(ctx);
    expect((await asientos()).find((a) => a.tipo === 'estudio.PomodoroCompletado')).toMatchObject({ dia: '2026-11-16', ocurridoEn: '2026-11-17T04:50:00.000Z', xp: 10 });
  });
});
