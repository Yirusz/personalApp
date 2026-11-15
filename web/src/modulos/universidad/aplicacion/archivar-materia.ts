import { archivar, type Materia } from '../dominio/materia';
import { EVENTOS, MATERIAS, obtenerMateria, type ContextoDeCasoDeUso } from './comun';

/** U2: archiva. Sus entregables y su historial se conservan. Se deshace con restaurarMateria. */
export function archivarMateria(ctx: ContextoDeCasoDeUso, materiaId: string): Promise<Materia> {
  return ctx.almacen.escribir([MATERIAS], async (tx) => {
    const materia = archivar(await obtenerMateria(tx, materiaId), ctx.reloj.ahora());
    await tx.poner(MATERIAS, materia);
    tx.publicar(EVENTOS.MateriaArchivada, { materiaId });
    return materia;
  });
}
