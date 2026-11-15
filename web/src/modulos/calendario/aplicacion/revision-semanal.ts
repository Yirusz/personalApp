/** C6: marcar la semana como planificada (una vez por semana ISO). */
import type { TransaccionDeLectura } from '../../../nucleo/contrato';
import { semanaIso } from '../dominio/fechas';
import { PUBLICADOS, REVISIONES, zonaDelUsuario, type ContextoDeCasoDeUso, type RevisionSemanal } from './comun';

export function semanaActual(ahora: Date): string {
  return semanaIso(zonaDelUsuario().aCivil(ahora.getTime()).fecha);
}

export function leerRevision(tx: TransaccionDeLectura, semana: string): Promise<RevisionSemanal | undefined> {
  return tx.obtener<RevisionSemanal>(REVISIONES, semana);
}

/** Si ya estaba planificada, no publica otra vez. */
export function planificarSemana(ctx: ContextoDeCasoDeUso): Promise<RevisionSemanal> {
  return ctx.almacen.escribir([REVISIONES], async (tx) => {
    const ahora = ctx.reloj.ahora();
    const semana = semanaActual(ahora);
    const previa = await tx.obtener<RevisionSemanal>(REVISIONES, semana);
    if (previa) return previa;
    const revision = { semana, hechaEn: ahora.toISOString() };
    await tx.poner(REVISIONES, revision);
    tx.publicar(PUBLICADOS.SemanaPlanificada, { semana });
    return revision;
  });
}
