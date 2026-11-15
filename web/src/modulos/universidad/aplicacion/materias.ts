/** Historia 1: casos de uso de materias (una función por caso de uso). */
import { archivar, asegurarNombreUnico, crearMateria as crear, editarMateria as editar, restaurar, type DatosDeMateria, type Materia } from '../dominio/materia';
import { EVENTOS, listarMaterias, MATERIAS, obtenerMateria, type ContextoDeCasoDeUso } from './comun';

export function crearMateria(ctx: ContextoDeCasoDeUso, datos: DatosDeMateria): Promise<Materia> {
  return ctx.almacen.escribir([MATERIAS], async (tx) => {
    asegurarNombreUnico(datos.nombre, datos.periodo, await listarMaterias(tx));
    const m = crear({ ...datos, id: ctx.nuevoId() }, ctx.reloj.ahora());
    await tx.poner(MATERIAS, m);
    tx.publicar(EVENTOS.MateriaCreada, { materiaId: m.id, nombre: m.nombre, color: m.color, periodo: m.periodo });
    return m;
  });
}

/** Edita nombre, profesor, color, periodo y créditos. Sin cambios reales, no publica. */
export function editarMateria(ctx: ContextoDeCasoDeUso, id: string, datos: DatosDeMateria): Promise<Materia> {
  return ctx.almacen.escribir([MATERIAS], async (tx) => {
    const actual = await obtenerMateria(tx, id);
    const m = editar(actual, datos, ctx.reloj.ahora());
    const campos = (['nombre', 'profesor', 'color', 'periodo', 'creditos'] as const).filter((c) => m[c] !== actual[c]);
    if (campos.length === 0) return actual;
    if (!m.archivada) asegurarNombreUnico(m.nombre, m.periodo, await listarMaterias(tx), id);
    await tx.poner(MATERIAS, m);
    tx.publicar(EVENTOS.MateriaEditada, { materiaId: id, campos });
    return m;
  });
}

export function archivarMateria(ctx: ContextoDeCasoDeUso, id: string): Promise<Materia> {
  return ctx.almacen.escribir([MATERIAS], async (tx) => {
    const m = archivar(await obtenerMateria(tx, id), ctx.reloj.ahora());
    await tx.poner(MATERIAS, m);
    tx.publicar(EVENTOS.MateriaArchivada, { materiaId: id });
    return m;
  });
}

export function restaurarMateria(ctx: ContextoDeCasoDeUso, id: string): Promise<Materia> {
  return ctx.almacen.escribir([MATERIAS], async (tx) => {
    const archivada = await obtenerMateria(tx, id);
    asegurarNombreUnico(archivada.nombre, archivada.periodo, await listarMaterias(tx), id);
    const m = restaurar(archivada, ctx.reloj.ahora());
    await tx.poner(MATERIAS, m);
    tx.publicar(EVENTOS.MateriaRestaurada, { materiaId: id });
    return m;
  });
}
