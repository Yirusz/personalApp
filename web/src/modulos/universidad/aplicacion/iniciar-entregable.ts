import { iniciar, type Entregable } from '../dominio/entregable';
import { ENTREGABLES, EVENTOS, obtenerEntregable, type ContextoDeCasoDeUso } from './comun';

/** U4: pendiente → en curso (desde aquí la talla queda bloqueada). */
export function iniciarEntregable(ctx: ContextoDeCasoDeUso, entregableId: string): Promise<Entregable> {
  return ctx.almacen.escribir([ENTREGABLES], async (tx) => {
    const entregable = iniciar(await obtenerEntregable(tx, entregableId), ctx.reloj.ahora());
    await tx.poner(ENTREGABLES, entregable);
    tx.publicar(EVENTOS.EntregableIniciado, { entregableId });
    return entregable;
  });
}
