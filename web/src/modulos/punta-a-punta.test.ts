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
import rpg from './rpg/modulo';
import { completarEntregable } from './universidad/aplicacion/completar-entregable';
import { crearMateria } from './universidad/aplicacion/crear-materia';
import { reabrirEntregable } from './universidad/aplicacion/reabrir-entregable';
import { registrarEntregable } from './universidad/aplicacion/registrar-entregable';
import universidad from './universidad/modulo';

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

describe('Universidad → eventos → RPG (reglas de reglas.v1.json)', () => {
  const HORA = 3_600_000;

  async function appUniversidad() {
    const e = await crearEntorno([universidad, rpg]);
    for (const s of rpg.suscripciones!(contexto(e, 'rpg'))) e.bus.registrar('rpg', s);
    await e.bus.iniciar();
    const ctx = contexto(e, 'universidad');
    const perfil = async () => {
      await e.bus.procesarPendientes();
      return e.almacen.paraModulo('rpg').leer(['perfil'], leerPerfil);
    };
    const materia = await crearMateria(ctx, { nombre: 'Física I', color: 'azul', creditos: null });
    const registrar = (venceEnHoras: number, talla: 'S' | 'M' | 'L' = 'M') =>
      registrarEntregable(ctx, {
        materiaId: materia.id,
        titulo: 'Taller',
        tipo: 'tarea',
        venceEn: new Date(e.reloj.ahora().getTime() + venceEnHoras * HORA).toISOString(),
        prioridad: 'media',
        talla,
      });
    return { e, ctx, perfil, registrar };
  }

  it('crear materia (5) + registrar con 72 h (3) + completar M a tiempo (35 × 1,2 = 42) = 50 XP', async () => {
    const { e, ctx, perfil, registrar } = await appUniversidad();
    const t = await registrar(72);
    e.reloj.avanzar(HORA);
    await completarEntregable(ctx, t.id);
    expect(await perfil()).toMatchObject({ xpTotal: 50, atributos: { organizacion: 8, disciplina: 42 } });
  });

  it('reabrir y volver a completar no da doble premio (unaVezPor: entregableId)', async () => {
    const { e, ctx, perfil, registrar } = await appUniversidad();
    const t = await registrar(24); // < 48 h: registrar no da XP
    e.reloj.avanzar(HORA);
    await completarEntregable(ctx, t.id);
    const antes = (await perfil())!.xpTotal;
    await reabrirEntregable(ctx, t.id);
    await completarEntregable(ctx, t.id);
    expect((await perfil())!.xpTotal).toBe(antes);
    const ultimo = (await e.almacen.paraModulo('rpg').leer(['registro'], (tx) => leerUltimosAsientos(tx, 1)))[0];
    expect(ultimo).toMatchObject({ tipo: 'universidad.EntregableCompletado', xp: 0, nota: 'ya-otorgado' });
  });

  it('completar 5 min después de crearlo no da XP; registrar con menos de 48 h tampoco', async () => {
    const { e, ctx, perfil, registrar } = await appUniversidad();
    const t = await registrar(10, 'L');
    e.reloj.avanzar(5 * 60_000);
    await completarEntregable(ctx, t.id);
    expect((await perfil())!.xpTotal).toBe(5); // solo la materia
  });

  it('crear muchas materias no "farmea": la XP por materias tiene tope diario', async () => {
    const { ctx, perfil } = await appUniversidad();
    for (const nombre of ['A', 'B', 'C', 'D', 'E']) await crearMateria(ctx, { nombre, color: 'gris', creditos: null });
    expect((await perfil())!.xpTotal).toBe(20); // 6 materias × 5, tope 20/día
  });
});
