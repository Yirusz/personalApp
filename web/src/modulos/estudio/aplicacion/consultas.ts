/** Lecturas para las pantallas y los proveedores, por índice (nunca todo el historial). */
import type { TransaccionDeLectura } from '../../../nucleo/contrato';
import { lunesDe, resumen, type Resumen } from '../dominio/estadisticas';
import type { SesionTerminada } from '../dominio/sesion';
import { ESTADO, INDICE_POR_DIA, INDICE_POR_FIN, leerEstado, SESIONES, type EstadoDeEstudio } from './comun';

export const ALMACENES_DE_ESTUDIO = [ESTADO, SESIONES];

const sumarDias = (fecha: string, n: number) => new Date(Date.parse(`${fecha}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

/** Sesiones de la semana (lunes–domingo) de `hoy`, por el índice de día. */
export function sesionesDeLaSemana(tx: TransaccionDeLectura, hoy: string): Promise<SesionTerminada[]> {
  const desde = lunesDe(hoy);
  return tx.listar<SesionTerminada>(SESIONES, { indice: INDICE_POR_DIA, desde, hasta: sumarDias(desde, 6) });
}

export async function leerPantalla(tx: TransaccionDeLectura, hoy: string): Promise<EstadoDeEstudio & { resumen: Resumen }> {
  const [estado, semana] = await Promise.all([leerEstado(tx), sesionesDeLaSemana(tx, hoy)]);
  return { ...estado, resumen: resumen(semana, hoy) };
}

/** Sesiones que terminaron en [desde, hasta) (ISO), por el índice de fin. */
export function sesionesEntre(tx: TransaccionDeLectura, desde: string, hasta: string): Promise<SesionTerminada[]> {
  return tx.listar<SesionTerminada>(SESIONES, { indice: INDICE_POR_FIN, desde, hasta }).then((l) => l.filter((s) => s.finalizadaEn < hasta));
}
