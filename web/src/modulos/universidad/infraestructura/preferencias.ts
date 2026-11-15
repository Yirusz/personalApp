/**
 * Preferencias de pantalla de Universidad (no son datos del dominio): el último
 * filtro usado, para conservarlo al volver (U5). localStorage puede no estar
 * disponible (modo privado estricto): entonces se usa el filtro inicial.
 */
import { FILTRO_INICIAL, FILTROS_DE_ESTADO, type FiltroDeEntregables, type FiltroDeEstado } from '../dominio/consultas';

const CLAVE = 'ludus.universidad.filtro';

export function leerFiltro(): FiltroDeEntregables {
  try {
    const guardado = JSON.parse(localStorage.getItem(CLAVE) ?? 'null') as Partial<FiltroDeEntregables> | null;
    const estado = FILTROS_DE_ESTADO.includes(guardado?.estado as FiltroDeEstado) ? (guardado!.estado as FiltroDeEstado) : FILTRO_INICIAL.estado;
    const materiaId = typeof guardado?.materiaId === 'string' ? guardado.materiaId : null;
    return { estado, materiaId };
  } catch {
    return FILTRO_INICIAL;
  }
}

export function guardarFiltro(filtro: FiltroDeEntregables): void {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(filtro));
  } catch {
    // Sin persistencia: el filtro dura mientras la pantalla esté abierta.
  }
}
