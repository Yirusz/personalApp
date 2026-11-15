import { editar, elementoDeAgenda, type CambiosDeEntregable, type Entregable } from '../dominio/entregable';
import { ENTREGABLES, EVENTOS, MATERIAS, obtenerEntregable, obtenerMateria, type ContextoDeCasoDeUso } from './comun';

/** Cambia título, tipo, prioridad o talla (la talla solo mientras esté pendiente). Sin cambios reales, no publica. */
export function editarEntregable(ctx: ContextoDeCasoDeUso, entregableId: string, cambios: CambiosDeEntregable): Promise<Entregable> {
  return ctx.almacen.escribir([MATERIAS, ENTREGABLES], async (tx) => {
    const actual = await obtenerEntregable(tx, entregableId);
    const editado = editar(actual, cambios, ctx.reloj.ahora());
    const campos = (['titulo', 'tipo', 'prioridad', 'talla'] as const).filter((c) => editado[c] !== actual[c]);
    if (campos.length === 0) return actual;
    const materia = await obtenerMateria(tx, editado.materiaId);
    await tx.poner(ENTREGABLES, editado);
    tx.publicar(EVENTOS.EntregableEditado, {
      entregableId,
      campos,
      talla: editado.talla,
      agenda: elementoDeAgenda(editado, materia.color),
    });
    return editado;
  });
}
