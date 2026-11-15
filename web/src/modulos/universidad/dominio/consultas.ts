/** Consultas puras: indicadores de urgencia (vencido / hoy / esta semana) y filtros. */
import type { Zona } from '../../../nucleo/dominio/zona-horaria';
import { esActivo, type EstadoDeTrabajo, type Trabajo } from './trabajo';

export const INDICADORES = ['vencido', 'hoy', 'semana', 'despues'] as const;
export type Indicador = (typeof INDICADORES)[number] | 'cerrado';

/** Lunes de la semana (lunes a domingo) de una fecha civil. */
function lunes(fecha: string): string {
  const ms = Date.parse(`${fecha}T00:00:00Z`);
  const dia = new Date(ms).getUTCDay() || 7;
  return new Date(ms - (dia - 1) * 86_400_000).toISOString().slice(0, 10);
}

/** Urgencia de un trabajo en la zona del usuario. Los no activos (entregado, calificado, cancelado) son "cerrado". */
export function indicador(t: Trabajo, ahora: Date, zona: Zona): Indicador {
  if (!esActivo(t.estado)) return 'cerrado';
  const vence = Date.parse(t.venceEn);
  if (vence < ahora.getTime()) return 'vencido';
  const hoy = zona.aCivil(ahora.getTime()).fecha;
  const dia = zona.aCivil(vence).fecha;
  if (dia === hoy) return 'hoy';
  if (lunes(dia) === lunes(hoy)) return 'semana';
  return 'despues';
}

export const FILTROS_DE_ESTADO = ['activos', 'pendiente', 'enProgreso', 'entregado', 'calificado', 'cancelado', 'todos'] as const;
export type FiltroDeEstado = (typeof FILTROS_DE_ESTADO)[number];

export interface FiltroDeTrabajos {
  /** null = todas las materias activas. */
  materiaId: string | null;
  estado: FiltroDeEstado;
}

export const FILTRO_INICIAL: FiltroDeTrabajos = { materiaId: null, estado: 'activos' };

const porVencimiento = (a: Trabajo, b: Trabajo) => a.venceEn.localeCompare(b.venceEn) || a.id.localeCompare(b.id);

function cumple(estado: EstadoDeTrabajo, filtro: FiltroDeEstado): boolean {
  if (filtro === 'todos') return true;
  if (filtro === 'activos') return esActivo(estado);
  return estado === filtro;
}

/** Filtra (los de materias archivadas no se muestran) y ordena: activos por fecha; cerrados del más reciente al más antiguo. */
export function filtrarTrabajos(trabajos: readonly Trabajo[], filtro: FiltroDeTrabajos, materiasActivas: ReadonlySet<string>): Trabajo[] {
  const lista = trabajos
    .filter((t) => materiasActivas.has(t.materiaId) && (filtro.materiaId === null || t.materiaId === filtro.materiaId) && cumple(t.estado, filtro.estado))
    .sort(porVencimiento);
  return filtro.estado === 'activos' || filtro.estado === 'pendiente' || filtro.estado === 'enProgreso' ? lista : lista.reverse();
}

export interface GrupoDeUrgencia {
  indicador: Indicador;
  trabajos: Trabajo[];
}

/** "Próximas entregas": activos agrupados por urgencia (vencido, hoy, esta semana, después), sin grupos vacíos. */
export function agruparProximas(trabajos: readonly Trabajo[], ahora: Date, zona: Zona): GrupoDeUrgencia[] {
  const grupos = new Map<Indicador, Trabajo[]>(INDICADORES.map((i) => [i, []]));
  for (const t of [...trabajos].sort(porVencimiento)) {
    const i = indicador(t, ahora, zona);
    if (i !== 'cerrado') grupos.get(i)!.push(t);
  }
  return [...grupos].filter(([, lista]) => lista.length > 0).map(([i, lista]) => ({ indicador: i, trabajos: lista }));
}
