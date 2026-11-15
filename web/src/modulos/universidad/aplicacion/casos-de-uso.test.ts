/**
 * Casos de uso de Universidad contra IndexedDB real en memoria (fake-indexeddb).
 * Todo es local (ADR-0002): los escenarios "sin conexión" se cumplen porque
 * ningún caso de uso usa la red; estas pruebas corren sin red.
 */
import { describe, expect, it } from 'vitest';
import type { EventoDeDominio } from '../../../nucleo/dominio/evento';
import { crearEntorno, type Entorno } from '../../../pruebas/entorno';
import { EntregableYaCompletado, MateriaArchivadaSinEntregables, MateriaNoEncontrada, MateriaRepetida, NombreDeMateriaInvalido, TallaBloqueada } from '../dominio/errores';
import { MIGRACIONES } from '../infraestructura/migraciones';
import { archivarMateria } from './archivar-materia';
import { DECLARACIONES, ENTREGABLES, type ContextoDeCasoDeUso } from './comun';
import { completarEntregable } from './completar-entregable';
import { leerEntregableConMateria, leerMaterias, leerPanel } from './consultas';
import { crearMateria } from './crear-materia';
import { editarEntregable } from './editar-entregable';
import { eliminarEntregable } from './eliminar-entregable';
import { iniciarEntregable } from './iniciar-entregable';
import { reabrirEntregable } from './reabrir-entregable';
import { registrarEntregable, type DatosParaRegistrar } from './registrar-entregable';
import { renombrarMateria } from './renombrar-materia';
import { reprogramarEntregable } from './reprogramar-entregable';
import { restaurarMateria } from './restaurar-materia';

const ESQUEMA = { id: 'universidad', migraciones: MIGRACIONES, eventos: DECLARACIONES };
const HORA = 3_600_000;

async function preparar() {
  const e: Entorno = await crearEntorno([ESQUEMA]);
  const eventos: EventoDeDominio[] = [];
  e.almacen.alPublicar((publicados) => eventos.push(...publicados));
  const ctx: ContextoDeCasoDeUso = { almacen: e.almacen.paraModulo('universidad'), reloj: e.reloj, nuevoId: () => e.ids.siguiente() };
  const ahora = () => e.reloj.ahora().getTime();
  const entregable = (materiaId: string, cambios: Partial<DatosParaRegistrar> = {}) =>
    registrarEntregable(ctx, {
      materiaId,
      titulo: 'Taller 3',
      tipo: 'tarea',
      venceEn: new Date(ahora() + 48 * HORA).toISOString(),
      prioridad: 'alta',
      talla: 'M',
      ...cambios,
    });
  const tipos = () => eventos.map((ev) => ev.tipo.replace('universidad.', ''));
  return { e, ctx, eventos, tipos, entregable };
}

describe('U1 · Crear materia', () => {
  it('crea "Cálculo II" en verde, aparece en la lista y publica MateriaCreada', async () => {
    const { ctx, eventos } = await preparar();
    const m = await crearMateria(ctx, { nombre: 'Cálculo II', color: 'verde', creditos: 4 });
    expect(await ctx.almacen.leer(['materias'], leerMaterias)).toEqual([m]);
    expect(eventos).toHaveLength(1);
    expect(eventos[0]).toMatchObject({
      tipo: 'universidad.MateriaCreada',
      modulo: 'universidad',
      datos: { materiaId: m.id, nombre: 'Cálculo II', color: 'verde' },
    });
  });

  it('no crea un nombre repetido entre las activas ("cálculo ii") ni publica nada', async () => {
    const { e, ctx, eventos } = await preparar();
    await crearMateria(ctx, { nombre: 'Cálculo II', color: 'verde', creditos: null });
    await expect(crearMateria(ctx, { nombre: 'cálculo ii', color: 'azul', creditos: null })).rejects.toThrow(MateriaRepetida);
    await expect(crearMateria(ctx, { nombre: '  ', color: 'azul', creditos: null })).rejects.toThrow(NombreDeMateriaInvalido);
    expect(eventos).toHaveLength(1);
    expect(await e.almacen.contarTodo()).toMatchObject({ universidad_materias: 1, nucleo_eventos: 1 });
  });

  it('sí permite reutilizar el nombre de una materia archivada', async () => {
    const { ctx } = await preparar();
    const vieja = await crearMateria(ctx, { nombre: 'Física I', color: 'azul', creditos: null });
    await archivarMateria(ctx, vieja.id);
    await expect(crearMateria(ctx, { nombre: 'Física I', color: 'rojo', creditos: null })).resolves.toBeDefined();
  });
});

describe('U2 · Editar y archivar materia', () => {
  it('archivar conserva los entregables; una archivada no recibe entregables nuevos', async () => {
    const { ctx, entregable, tipos } = await preparar();
    const m = await crearMateria(ctx, { nombre: 'Cálculo II', color: 'verde', creditos: null });
    for (let i = 0; i < 3; i++) await completarEntregable(ctx, (await entregable(m.id)).id);
    await archivarMateria(ctx, m.id);

    const panel = await ctx.almacen.leer(['materias', ENTREGABLES], leerPanel);
    expect(panel.materias[0]!.archivada).toBe(true);
    expect(panel.entregables).toHaveLength(3);
    await expect(entregable(m.id)).rejects.toThrow(MateriaArchivadaSinEntregables);
    expect(tipos().at(-1)).toBe('MateriaArchivada');
  });

  it('deshacer el archivado (restaurar) la vuelve a activar y publica MateriaRestaurada', async () => {
    const { ctx, tipos } = await preparar();
    const m = await crearMateria(ctx, { nombre: 'Cálculo II', color: 'verde', creditos: null });
    await archivarMateria(ctx, m.id);
    expect((await restaurarMateria(ctx, m.id)).archivada).toBe(false);
    expect(tipos()).toEqual(['MateriaCreada', 'MateriaArchivada', 'MateriaRestaurada']);
  });

  it('no restaura si mientras tanto se creó otra activa con el mismo nombre', async () => {
    const { ctx } = await preparar();
    const m = await crearMateria(ctx, { nombre: 'Física I', color: 'azul', creditos: null });
    await archivarMateria(ctx, m.id);
    await crearMateria(ctx, { nombre: 'física i', color: 'rojo', creditos: null });
    await expect(restaurarMateria(ctx, m.id)).rejects.toThrow(MateriaRepetida);
  });

  it('renombrar publica MateriaRenombrada; el mismo nombre no publica; un nombre ocupado falla', async () => {
    const { ctx, tipos } = await preparar();
    const a = await crearMateria(ctx, { nombre: 'Física I', color: 'azul', creditos: null });
    await crearMateria(ctx, { nombre: 'Cálculo II', color: 'verde', creditos: null });
    await renombrarMateria(ctx, a.id, 'Física Mecánica');
    await renombrarMateria(ctx, a.id, '  Física   Mecánica ');
    await expect(renombrarMateria(ctx, a.id, 'CÁLCULO II')).rejects.toThrow(MateriaRepetida);
    expect(tipos()).toEqual(['MateriaCreada', 'MateriaCreada', 'MateriaRenombrada']);
  });
});

describe('U3 · Registrar entregable', () => {
  it('guarda y publica EntregableCreado con antelación y datos.agenda con el color de la materia', async () => {
    const { ctx, eventos, entregable } = await preparar();
    const m = await crearMateria(ctx, { nombre: 'Física I', color: 'azul', creditos: null });
    const creado = await entregable(m.id, { venceEn: '2026-11-21T04:59:00Z' });
    expect(eventos.at(-1)).toMatchObject({
      tipo: 'universidad.EntregableCreado',
      datos: {
        entregableId: creado.id,
        materiaId: m.id,
        talla: 'M',
        venceEn: '2026-11-21T04:59:00.000Z',
        antelacionHoras: 157,
        agenda: { id: creado.id, titulo: 'Taller 3', inicio: '2026-11-21T04:59:00.000Z', tipo: 'vencimiento', estado: 'pendiente', color: 'azul' },
      },
    });
  });

  it('falla con una materia inexistente y no guarda nada', async () => {
    const { e, entregable } = await preparar();
    await expect(entregable('no-existe')).rejects.toThrow(MateriaNoEncontrada);
    expect(await e.almacen.contarTodo()).toMatchObject({ universidad_entregables: 0, nucleo_eventos: 0 });
  });
});

describe('U4 · Avanzar el estado', () => {
  it('completar a tiempo publica EntregableCompletado con aTiempo, talla y minutos desde la creación', async () => {
    const { e, ctx, eventos, entregable } = await preparar();
    const m = await crearMateria(ctx, { nombre: 'Física I', color: 'azul', creditos: null });
    const t = await entregable(m.id, { venceEn: new Date(e.reloj.ahora().getTime() + 24 * HORA).toISOString() });
    e.reloj.avanzar(2 * HORA);
    await completarEntregable(ctx, t.id);
    expect(eventos.at(-1)).toMatchObject({
      tipo: 'universidad.EntregableCompletado',
      datos: { entregableId: t.id, materiaId: m.id, talla: 'M', aTiempo: true, minutosDesdeCreacion: 120, agenda: { estado: 'hecho' } },
    });
    await expect(completarEntregable(ctx, t.id)).rejects.toThrow(EntregableYaCompletado);
  });

  it('la talla no cambia una vez en curso; el título sí', async () => {
    const { ctx, entregable, tipos } = await preparar();
    const m = await crearMateria(ctx, { nombre: 'Física I', color: 'azul', creditos: null });
    const t = await entregable(m.id);
    await iniciarEntregable(ctx, t.id);
    await expect(editarEntregable(ctx, t.id, { talla: 'L' })).rejects.toThrow(TallaBloqueada);
    await editarEntregable(ctx, t.id, { titulo: 'Taller 3 (grupal)' });
    await editarEntregable(ctx, t.id, { titulo: 'Taller 3 (grupal)' }); // sin cambios: no publica
    expect(tipos()).toEqual(['MateriaCreada', 'EntregableCreado', 'EntregableIniciado', 'EntregableEditado']);
  });

  it('reabrir y volver a completar publica EntregableCompletado otra vez (el RPG decide no premiar)', async () => {
    const { ctx, entregable, tipos } = await preparar();
    const m = await crearMateria(ctx, { nombre: 'Física I', color: 'azul', creditos: null });
    const t = await entregable(m.id);
    await completarEntregable(ctx, t.id);
    await reabrirEntregable(ctx, t.id);
    await completarEntregable(ctx, t.id);
    expect(tipos().filter((x) => x === 'EntregableCompletado')).toHaveLength(2);
    expect(tipos()).toContain('EntregableReabierto');
  });
});

describe('U6 · Reprogramar o eliminar', () => {
  it('reprogramar publica EntregableReprogramado con la fecha anterior y la nueva', async () => {
    const { ctx, eventos, entregable } = await preparar();
    const m = await crearMateria(ctx, { nombre: 'Física I', color: 'azul', creditos: null });
    const t = await entregable(m.id, { venceEn: '2026-11-21T04:59:00Z' });
    await reprogramarEntregable(ctx, t.id, '2026-11-24T04:59:00Z');
    expect(eventos.at(-1)).toMatchObject({
      tipo: 'universidad.EntregableReprogramado',
      datos: { venceEnAnterior: '2026-11-21T04:59:00.000Z', venceEn: '2026-11-24T04:59:00.000Z', agenda: { inicio: '2026-11-24T04:59:00.000Z' } },
    });
    await reprogramarEntregable(ctx, t.id, '2026-11-24T04:59:00.000Z'); // misma fecha
    expect(eventos.filter((ev) => ev.tipo === 'universidad.EntregableReprogramado')).toHaveLength(1);
  });

  it('eliminar borra y publica EntregableEliminado con la agenda marcada; repetirlo no hace nada', async () => {
    const { ctx, eventos, entregable } = await preparar();
    const m = await crearMateria(ctx, { nombre: 'Física I', color: 'azul', creditos: null });
    const t = await entregable(m.id);
    await eliminarEntregable(ctx, t.id);
    expect(await ctx.almacen.leer(['materias', ENTREGABLES], (tx) => leerEntregableConMateria(tx, t.id))).toBeNull();
    expect(eventos.at(-1)).toMatchObject({ tipo: 'universidad.EntregableEliminado', datos: { entregableId: t.id, agenda: { estado: 'eliminado' } } });
    await eliminarEntregable(ctx, t.id);
    expect(eventos.filter((ev) => ev.tipo === 'universidad.EntregableEliminado')).toHaveLength(1);
  });
});
