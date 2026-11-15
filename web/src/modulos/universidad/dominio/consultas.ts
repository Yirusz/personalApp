/** Consultas puras sobre entregables (U5). Sin almacenamiento: reciben listas y devuelven listas. */
import type { Entregable, EstadoDeEntregable } from './entregable';

export const HORAS_PROXIMOS = 72;

export const FILTROS_DE_ESTADO = ['activos', 'pendiente', 'enCurso', 'completado', 'todos'] as const;
export type FiltroDeEstado = (typeof FILTROS_DE_ESTADO)[number];

export interface FiltroDeEntregables {
  /** `null` = todas las materias activas. */
  materiaId: string | null;
  estado: FiltroDeEstado;
}

export const FILTRO_INICIAL: FiltroDeEntregables = { materiaId: null, estado: 'activos' };

const porVencimiento = (a: Entregable, b: Entregable) => a.venceEn.localeCompare(b.venceEn) || a.id.localeCompare(b.id);

/** Sin completar y con vencimiento dentro de las próximas `horas` (incluye los ya vencidos), el más cercano primero. */
export function proximosVencimientos(entregables: readonly Entregable[], ahora: Date, horas = HORAS_PROXIMOS): Entregable[] {
  const limite = ahora.getTime() + horas * 3_600_000;
  return entregables.filter((e) => e.estado !== 'completado' && Date.parse(e.venceEn) <= limite).sort(porVencimiento);
}

function cumpleEstado(estado: EstadoDeEntregable, filtro: FiltroDeEstado): boolean {
  if (filtro === 'todos') return true;
  if (filtro === 'activos') return estado !== 'completado';
  return estado === filtro;
}

/**
 * Lista filtrada. Los de materias archivadas no se muestran (siguen guardados).
 * Orden: por vencimiento ascendente; los completados, del más reciente al más antiguo.
 */
export function filtrarEntregables(
  entregables: readonly Entregable[],
  filtro: FiltroDeEntregables,
  materiasActivas: ReadonlySet<string>,
): Entregable[] {
  const lista = entregables
    .filter((e) => materiasActivas.has(e.materiaId))
    .filter((e) => filtro.materiaId === null || e.materiaId === filtro.materiaId)
    .filter((e) => cumpleEstado(e.estado, filtro.estado))
    .sort(porVencimiento);
  return filtro.estado === 'completado' ? lista.reverse() : lista;
}
