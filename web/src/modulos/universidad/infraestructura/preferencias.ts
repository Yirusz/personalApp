/** Último filtro de la lista (preferencia de pantalla, no dato del dominio). */
import { FILTRO_INICIAL, FILTROS_DE_ESTADO, type FiltroDeEstado, type FiltroDeTrabajos } from '../dominio/consultas';

const CLAVE = 'ludus.universidad.filtro';

export function leerFiltro(): FiltroDeTrabajos {
  try {
    const g = JSON.parse(localStorage.getItem(CLAVE) ?? 'null') as Partial<FiltroDeTrabajos> | null;
    const estado = FILTROS_DE_ESTADO.includes(g?.estado as FiltroDeEstado) ? (g!.estado as FiltroDeEstado) : FILTRO_INICIAL.estado;
    return { estado, materiaId: typeof g?.materiaId === 'string' ? g.materiaId : null };
  } catch {
    return FILTRO_INICIAL;
  }
}

export function guardarFiltro(filtro: FiltroDeTrabajos): void {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(filtro));
  } catch {
    // Sin persistencia: el filtro dura mientras la pantalla esté abierta.
  }
}
