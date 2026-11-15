/**
 * Casos de uso de Universidad v2 contra IndexedDB en memoria. Todo es local:
 * los escenarios "sin conexión" se cumplen porque nada usa la red.
 */
import { describe, expect, it } from 'vitest';
import type { EventoDeDominio } from '../../../nucleo/dominio/evento';
import { crearEntorno, type Entorno } from '../../../pruebas/entorno';
import { EstadoNoPermite, MateriaRepetida, NotaInvalida, TipoBloqueado } from '../dominio/errores';
import { MIGRACIONES } from '../infraestructura/migraciones';
import { DECLARACIONES, TRABAJOS, type ContextoDeCasoDeUso } from './comun';
import { leerPanel, leerTrabajoConMateria } from './consultas';
import { archivarMateria, crearMateria, editarMateria, restaurarMateria } from './materias';
import { crearProveedores, TIPO_MATERIA, TIPO_TRABAJO } from './proveedores';
import {
  agregarSubtarea,
  calificarTrabajo,
  cancelarTrabajo,
  editarTrabajo,
  eliminarTrabajo,
  entregarTrabajo,
  iniciarTrabajo,
  marcarSubtarea,
  reabrirTrabajo,
  registrarTrabajo,
  reprogramarTrabajo,
  type DatosParaRegistrar,
} from './trabajos';

const ESQUEMA = { id: 'universidad', migraciones: MIGRACIONES, eventos: DECLARACIONES };
const HORA = 3_600_000;

async function preparar(e?: Entorno) {
  e ??= await crearEntorno([ESQUEMA]);
  const eventos: EventoDeDominio[] = [];
  e.almacen.alPublicar((evs) => eventos.push(...evs));
  const ctx: ContextoDeCasoDeUso = { almacen: e.almacen.paraModulo('universidad'), reloj: e.reloj, nuevoId: () => e.ids.siguiente() };
  const tipos = () => eventos.map((x) => x.tipo.replace('universidad.', ''));
  const materia = (nombre = 'Física I', periodo = '2026-2') => crearMateria(ctx, { nombre, profesor: 'Ana Gómez', color: 'azul', periodo, creditos: 3 });
  const trabajo = (materiaId: string, c: Partial<DatosParaRegistrar> = {}) =>
    registrarTrabajo(ctx, {
      materiaId,
      titulo: 'Taller 3',
      tipo: 'taller',
      descripcion: '',
      venceEn: new Date(e.reloj.ahora().getTime() + 72 * HORA).toISOString(),
      prioridad: 'alta',
      peso: 200,
      ...c,
    });
  return { e, ctx, eventos, tipos, materia, trabajo };
}

describe('1 · Materias', () => {
  it('crea con profesor y periodo; edita todo (incluido el color); archiva y restaura', async () => {
    const { ctx, materia, tipos, eventos } = await preparar();
    const m = await materia();
    expect(eventos[0]!.datos).toEqual({ materiaId: m.id, nombre: 'Física I', color: 'azul', periodo: '2026-2' });
    await editarMateria(ctx, m.id, { nombre: 'Física I', profesor: 'Ana Gómez', color: 'verde', periodo: '2026-2', creditos: 3 });
    await editarMateria(ctx, m.id, { nombre: 'Física I', profesor: 'Ana Gómez', color: 'verde', periodo: '2026-2', creditos: 3 }); // sin cambios
    await archivarMateria(ctx, m.id);
    await restaurarMateria(ctx, m.id);
    expect(tipos()).toEqual(['MateriaCreada', 'MateriaEditada', 'MateriaArchivada', 'MateriaRestaurada']);
    expect(eventos[1]!.datos).toEqual({ materiaId: m.id, campos: ['color'] });
  });

  it('el mismo nombre en el mismo periodo se rechaza; en otro periodo se permite', async () => {
    const { materia } = await preparar();
    await materia();
    await expect(materia('física i')).rejects.toThrow(MateriaRepetida);
    await expect(materia('Física I', '2027-1')).resolves.toBeDefined();
  });
});

describe('2–3 · Trabajos y estados', () => {
  it('ciclo completo: crear → iniciar → entregar (a tiempo) → calificar, con los datos que usa el RPG', async () => {
    const { e, ctx, materia, trabajo, tipos, eventos } = await preparar();
    const m = await materia();
    const t = await trabajo(m.id, { tipo: 'parcial', peso: 250 });
    expect(eventos.at(-1)).toMatchObject({ tipo: 'universidad.TrabajoCreado', datos: { trabajoId: t.id, tipo: 'parcial', peso: 250, antelacionHoras: 72 } });
    await iniciarTrabajo(ctx, t.id);
    e.reloj.avanzar(24 * HORA);
    await entregarTrabajo(ctx, t.id);
    expect(eventos.at(-1)).toMatchObject({
      tipo: 'universidad.TrabajoEntregado',
      datos: { trabajoId: t.id, materiaId: m.id, tipo: 'parcial', peso: 250, aTiempo: true, minutosDesdeCreacion: 1440 },
    });
    await calificarTrabajo(ctx, t.id, 42);
    await calificarTrabajo(ctx, t.id, 42); // misma nota: no publica
    await calificarTrabajo(ctx, t.id, 45); // corrección
    expect(eventos.filter((x) => x.tipo === 'universidad.TrabajoCalificado').map((x) => x.datos)).toEqual([
      { trabajoId: t.id, materiaId: m.id, nota: 42, aprobado: true, correccion: false },
      { trabajoId: t.id, materiaId: m.id, nota: 45, aprobado: true, correccion: true },
    ]);
    expect(tipos()).toEqual(['MateriaCreada', 'TrabajoCreado', 'TrabajoIniciado', 'TrabajoEntregado', 'TrabajoCalificado', 'TrabajoCalificado']);
  });

  it('entregar tarde queda registrado como tarde', async () => {
    const { e, ctx, materia, trabajo, eventos } = await preparar();
    const t = await trabajo((await materia()).id, { venceEn: new Date(e.reloj.ahora().getTime() + HORA).toISOString() });
    e.reloj.avanzar(2 * HORA);
    await entregarTrabajo(ctx, t.id);
    expect(eventos.at(-1)!.datos).toMatchObject({ aTiempo: false });
  });

  it('transiciones inválidas no guardan ni publican; reabrir es deliberado', async () => {
    const { ctx, materia, trabajo, tipos } = await preparar();
    const t = await trabajo((await materia()).id);
    await expect(calificarTrabajo(ctx, t.id, 40)).rejects.toThrow(EstadoNoPermite);
    await expect(calificarTrabajo(ctx, t.id, 60)).rejects.toThrow();
    await cancelarTrabajo(ctx, t.id);
    await expect(iniciarTrabajo(ctx, t.id)).rejects.toThrow(EstadoNoPermite);
    await expect(reprogramarTrabajo(ctx, t.id, '2026-12-01T04:59:00Z')).rejects.toThrow(EstadoNoPermite);
    await reabrirTrabajo(ctx, t.id);
    expect(tipos()).toEqual(['MateriaCreada', 'TrabajoCreado', 'TrabajoCancelado', 'TrabajoReabierto']);
  });

  it('6 · la nota fuera de 0,0–5,0 se rechaza; el tipo no cambia una vez entregado', async () => {
    const { ctx, materia, trabajo } = await preparar();
    const t = await trabajo((await materia()).id);
    await entregarTrabajo(ctx, t.id);
    await expect(calificarTrabajo(ctx, t.id, 51)).rejects.toThrow(NotaInvalida);
    await expect(editarTrabajo(ctx, t.id, { tipo: 'proyecto' })).rejects.toThrow(TipoBloqueado);
  });

  it('eliminar borra y publica; repetirlo no hace nada', async () => {
    const { ctx, materia, trabajo, tipos } = await preparar();
    const t = await trabajo((await materia()).id);
    await eliminarTrabajo(ctx, t.id);
    await eliminarTrabajo(ctx, t.id);
    expect(await ctx.almacen.leer(['materias', TRABAJOS], (tx) => leerTrabajoConMateria(tx, t.id))).toBeNull();
    expect(tipos().filter((x) => x === 'TrabajoEliminado')).toHaveLength(1);
  });
});

describe('5 · Subtareas', () => {
  it('se guardan dentro del trabajo y NO publican eventos (no dan puntos)', async () => {
    const { ctx, materia, trabajo, eventos } = await preparar();
    const t = await trabajo((await materia()).id);
    const antes = eventos.length;
    let r = await agregarSubtarea(ctx, t.id, 'Leer el enunciado');
    r = await marcarSubtarea(ctx, t.id, r.subtareas[0]!.id, true);
    expect(r.subtareas).toEqual([expect.objectContaining({ texto: 'Leer el enunciado', hecha: true })]);
    expect(eventos.length).toBe(antes);
  });
});

describe('Migración v2: los datos de la iteración 1 se convierten', () => {
  it('entregable "completado" con talla → trabajo "entregado" sin talla; materia sin periodo → con periodo', async () => {
    const e = await crearEntorno([{ id: 'universidad', migraciones: [MIGRACIONES[0]!] }]);
    await e.almacen.paraModulo('universidad').escribir(['materias', TRABAJOS], async (tx) => {
      await tx.poner('materias', { id: 'm', nombre: 'Química', color: 'rojo', creditos: null, archivada: false, creadaEn: '2026-03-02T15:00:00.000Z', actualizadaEn: '2026-03-02T15:00:00.000Z' });
      await tx.poner(TRABAJOS, {
        id: 'e',
        materiaId: 'm',
        titulo: 'Informe',
        tipo: 'trabajo',
        venceEn: '2026-03-20T04:59:00.000Z',
        prioridad: 'media',
        talla: 'L',
        estado: 'completado',
        creadoEn: '2026-03-02T15:00:00.000Z',
        actualizadoEn: '2026-03-10T15:00:00.000Z',
        completadoEn: '2026-03-10T15:00:00.000Z',
      });
    });
    const nuevo = await e.reabrir([ESQUEMA]);
    const almacen = nuevo.almacen.paraModulo('universidad');
    const crudo = await almacen.leer([TRABAJOS], (tx) => tx.obtener<Record<string, unknown>>(TRABAJOS, 'e'));
    expect(crudo).toMatchObject({ tipo: 'taller', estado: 'entregado', entregadoEn: '2026-03-10T15:00:00.000Z', subtareas: [], peso: null });
    expect(crudo).not.toHaveProperty('talla');
    const panel = await almacen.leer(['materias', TRABAJOS], leerPanel);
    expect(panel.materias[0]).toMatchObject({ periodo: '2026-1', profesor: '' });
  });
});

describe('Integración por consulta: fuente de calendario y referencias', () => {
  it('la fuente da los vencimientos del rango con color y ruta; los cancelados no; avisa cambios', async () => {
    const { e, ctx, materia, trabajo } = await preparar();
    const m = await materia();
    const t1 = await trabajo(m.id, { venceEn: '2026-11-20T04:59:00Z' });
    const t2 = await trabajo(m.id, { titulo: 'Quiz', tipo: 'quiz', venceEn: '2026-11-18T04:59:00Z' });
    await trabajo(m.id, { titulo: 'Fuera', venceEn: '2026-12-20T04:59:00Z' });
    await cancelarTrabajo(ctx, t2.id);
    const [fuente] = crearProveedores(ctx).fuentesDeCalendario!;
    let cambios = 0;
    const dejar = fuente!.alCambiar(() => cambios++);
    const elementos = await fuente!.elementos({ desde: '2026-11-16T05:00:00Z', hasta: '2026-11-23T05:00:00Z' });
    expect(elementos).toEqual([{ id: t1.id, titulo: 'Taller 3', inicio: '2026-11-20T04:59:00.000Z', tipo: 'vencimiento', estado: 'pendiente', color: 'azul', ruta: `/universidad/trabajos/${t1.id}` }]);
    await entregarTrabajo(ctx, t1.id);
    await new Promise((r) => setTimeout(r, 0));
    expect(cambios).toBeGreaterThan(0);
    dejar();
    expect(e).toBeDefined();
  });

  it('referencias de materias y trabajos para vincular desde otros módulos (búsqueda sin tildes)', async () => {
    const { ctx, materia, trabajo } = await preparar();
    const m = await materia('Cálculo II');
    const t = await trabajo(m.id, { titulo: 'Parcial 2', tipo: 'parcial' });
    const { referencias } = crearProveedores(ctx);
    expect(referencias!.tipos).toEqual([TIPO_MATERIA, TIPO_TRABAJO]);
    expect(await referencias!.buscar({ tipo: TIPO_MATERIA, texto: 'calculo' })).toEqual([
      { tipo: TIPO_MATERIA, id: m.id, titulo: 'Cálculo II', detalle: '2026-2 · Ana Gómez', color: 'azul', ruta: '/universidad/materias', activa: true },
    ]);
    expect((await referencias!.buscar({ tipo: TIPO_TRABAJO })).map((r) => [r.titulo, r.detalle])).toEqual([['Parcial 2', 'Cálculo II']]);
    await archivarMateria(ctx, m.id);
    expect(await referencias!.buscar({ tipo: TIPO_MATERIA })).toEqual([]);
    expect(await referencias!.buscar({ tipo: TIPO_MATERIA, ids: [m.id] })).toHaveLength(1); // por id sí aparece (para mostrar vínculos viejos)
    expect(t).toBeDefined();
  });
});
