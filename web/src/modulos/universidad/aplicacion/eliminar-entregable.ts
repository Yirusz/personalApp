import { elementoDeAgenda } from '../dominio/entregable';
import type { Entregable } from '../dominio/entregable';
import { ENTREGABLES, EVENTOS, MATERIAS, obtenerMateria, type ContextoDeCasoDeUso } from './comun';

/**
 * U6: borra el entregable y publica EntregableEliminado (el calendario lo quita).
 * La UI lo llama al vencer los 10 s de "Deshacer"; el registro de eventos conserva su historia.
 * Si ya no existe (se eliminó en otra pestaña), no hace nada.
 */
export function eliminarEntregable(ctx: ContextoDeCasoDeUso, entregableId: string): Promise<void> {
  return ctx.almacen.escribir([MATERIAS, ENTREGABLES], async (tx) => {
    const entregable = await tx.obtener<Entregable>(ENTREGABLES, entregableId);
    if (!entregable) return;
    const materia = await obtenerMateria(tx, entregable.materiaId);
    await tx.borrar(ENTREGABLES, entregableId);
    tx.publicar(EVENTOS.EntregableEliminado, { entregableId, agenda: elementoDeAgenda(entregable, materia.color, true) });
  });
}
