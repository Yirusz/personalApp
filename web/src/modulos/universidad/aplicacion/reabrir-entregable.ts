import { elementoDeAgenda, reabrir, type Entregable } from '../dominio/entregable';
import { ENTREGABLES, EVENTOS, MATERIAS, obtenerEntregable, obtenerMateria, type ContextoDeCasoDeUso } from './comun';

/** U4: completado → en curso. Volver a completarlo publica otra vez el evento; el RPG no premia dos veces (unaVezPor). */
export function reabrirEntregable(ctx: ContextoDeCasoDeUso, entregableId: string): Promise<Entregable> {
  return ctx.almacen.escribir([MATERIAS, ENTREGABLES], async (tx) => {
    const entregable = reabrir(await obtenerEntregable(tx, entregableId), ctx.reloj.ahora());
    const materia = await obtenerMateria(tx, entregable.materiaId);
    await tx.poner(ENTREGABLES, entregable);
    tx.publicar(EVENTOS.EntregableReabierto, { entregableId, agenda: elementoDeAgenda(entregable, materia.color) });
    return entregable;
  });
}
