import { completar, elementoDeAgenda, type ResultadoDeCompletar } from '../dominio/entregable';
import { ENTREGABLES, EVENTOS, MATERIAS, obtenerEntregable, obtenerMateria, type ContextoDeCasoDeUso } from './comun';

/**
 * U4: marca como completado y publica EntregableCompletado con los datos que el
 * RPG necesita (talla, aTiempo, minutosDesdeCreacion). Este módulo no calcula XP.
 */
export function completarEntregable(ctx: ContextoDeCasoDeUso, entregableId: string): Promise<ResultadoDeCompletar> {
  return ctx.almacen.escribir([MATERIAS, ENTREGABLES], async (tx) => {
    const resultado = completar(await obtenerEntregable(tx, entregableId), ctx.reloj.ahora());
    const { entregable } = resultado;
    const materia = await obtenerMateria(tx, entregable.materiaId);
    await tx.poner(ENTREGABLES, entregable);
    tx.publicar(EVENTOS.EntregableCompletado, {
      entregableId,
      materiaId: entregable.materiaId,
      talla: entregable.talla,
      aTiempo: resultado.aTiempo,
      minutosDesdeCreacion: resultado.minutosDesdeCreacion,
      agenda: elementoDeAgenda(entregable, materia.color),
    });
    return resultado;
  });
}
