import { asegurarNombreUnico, restaurar, type Materia } from '../dominio/materia';
import { EVENTOS, MATERIAS, obtenerMateria, type ContextoDeCasoDeUso } from './comun';

/** U2: vuelve a activar una materia archivada (también es el "Deshacer" de archivar). */
export function restaurarMateria(ctx: ContextoDeCasoDeUso, materiaId: string): Promise<Materia> {
  return ctx.almacen.escribir([MATERIAS], async (tx) => {
    const archivada = await obtenerMateria(tx, materiaId);
    // Mientras estuvo archivada pudo crearse otra activa con el mismo nombre.
    asegurarNombreUnico(archivada.nombre, await tx.listar<Materia>(MATERIAS), materiaId);
    const materia = restaurar(archivada, ctx.reloj.ahora());
    await tx.poner(MATERIAS, materia);
    tx.publicar(EVENTOS.MateriaRestaurada, { materiaId });
    return materia;
  });
}
