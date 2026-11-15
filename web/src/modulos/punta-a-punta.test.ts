/**
 * Prueba de punta a punta del contrato de módulos: el módulo de ejemplo
 * guarda un registro y publica un evento; el RPG (que el ejemplo no conoce)
 * lo convierte en experiencia según reglas.v1.json.
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
