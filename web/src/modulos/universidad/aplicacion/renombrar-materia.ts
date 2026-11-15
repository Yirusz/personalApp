import { asegurarNombreUnico, nombreDeMateria, renombrar, type Materia } from '../dominio/materia';
import { EVENTOS, MATERIAS, obtenerMateria, type ContextoDeCasoDeUso } from './comun';

/** U2: renombra. Si el nombre no cambia, no publica nada. */
export function renombrarMateria(ctx: ContextoDeCasoDeUso, materiaId: string, nombre: string): Promise<Materia> {
  return ctx.almacen.escribir([MATERIAS], async (tx) => {
    const actual = await obtenerMateria(tx, materiaId);
    if (nombreDeMateria(nombre) === actual.nombre) return actual;
    if (!actual.archivada) asegurarNombreUnico(nombre, await tx.listar<Materia>(MATERIAS), materiaId);
    const materia = renombrar(actual, nombre, ctx.reloj.ahora());
    await tx.poner(MATERIAS, materia);
    tx.publicar(EVENTOS.MateriaRenombrada, { materiaId, nombre: materia.nombre });
    return materia;
  });
}
