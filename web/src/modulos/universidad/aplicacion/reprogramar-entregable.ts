import { elementoDeAgenda, reprogramar, type Entregable } from '../dominio/entregable';
import { ENTREGABLES, EVENTOS, MATERIAS, obtenerEntregable, obtenerMateria, type ContextoDeCasoDeUso } from './comun';

/** U6: cambia la fecha de entrega y publica EntregableReprogramado (el calendario lo mueve). Misma fecha → no publica. */
export function reprogramarEntregable(ctx: ContextoDeCasoDeUso, entregableId: string, venceEn: string): Promise<Entregable> {
  return ctx.almacen.escribir([MATERIAS, ENTREGABLES], async (tx) => {
    const actual = await obtenerEntregable(tx, entregableId);
    const { entregable, venceEnAnterior } = reprogramar(actual, venceEn, ctx.reloj.ahora());
    if (entregable.venceEn === venceEnAnterior) return actual;
    const materia = await obtenerMateria(tx, entregable.materiaId);
    await tx.poner(ENTREGABLES, entregable);
    tx.publicar(EVENTOS.EntregableReprogramado, {
      entregableId,
      venceEnAnterior,
      venceEn: entregable.venceEn,
      agenda: elementoDeAgenda(entregable, materia.color),
    });
    return entregable;
  });
}
