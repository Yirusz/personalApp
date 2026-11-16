/**
 * R2: racha semanal flexible (docs/gamificacion.md §4). Funciones puras.
 * - Semana = lunes a domingo en la zona del usuario; cierra el lunes 00:00 (sin gracia).
 * - Se evalúa semana por semana, en orden, a partir de los días activos.
 * - Perder la racha solo quita el multiplicador: la XP nunca baja.
 */
import type { Zona } from '../../../nucleo/dominio/zona-horaria';

export interface ParametrosDeRacha {
  diasActivosPorSemana: number;
  bonoPorSemana: number;
  bonoMaximo: number;
  semanasPorComodin: number;
  comodinesMaximos: number;
}

export interface EstadoDeRacha {
  /** Semanas cumplidas consecutivas (los comodines la mantienen). */
  semanas: number;
  comodines: number;
  /** Semanas cumplidas desde el último comodín ganado. */
  cumplidasParaComodin: number;
}

export const RACHA_INICIAL: EstadoDeRacha = { semanas: 0, comodines: 0, cumplidasParaComodin: 0 };

export type ResultadoDeSemana = 'cumplida' | 'comodin' | 'perdida' | 'sin-racha';

export function multiplicadorDeRacha(semanas: number, r: Pick<ParametrosDeRacha, 'bonoPorSemana' | 'bonoMaximo'>): number {
  return 1 + Math.min(r.bonoPorSemana * Math.max(0, semanas), r.bonoMaximo);
}

export function evaluarSemana(e: EstadoDeRacha, diasActivos: number, r: ParametrosDeRacha): { estado: EstadoDeRacha; resultado: ResultadoDeSemana; comodinGanado: boolean } {
  if (diasActivos >= r.diasActivosPorSemana) {
    let { comodines } = e;
    let cumplidasParaComodin = e.cumplidasParaComodin + 1;
    let comodinGanado = false;
    if (cumplidasParaComodin >= r.semanasPorComodin) {
      cumplidasParaComodin = 0;
      if (comodines < r.comodinesMaximos) {
        comodines++;
        comodinGanado = true;
      }
    }
    return { estado: { semanas: e.semanas + 1, comodines, cumplidasParaComodin }, resultado: 'cumplida', comodinGanado };
  }
  if (e.semanas === 0) return { estado: e, resultado: 'sin-racha', comodinGanado: false };
  if (e.comodines > 0) return { estado: { ...e, comodines: e.comodines - 1 }, resultado: 'comodin', comodinGanado: false };
  return { estado: RACHA_INICIAL, resultado: 'perdida', comodinGanado: false };
}

// ---- Fechas civiles (AAAA-MM-DD) ----

const MS_DIA = 86_400_000;
const sumarDias = (f: string, n: number) => new Date(Date.parse(`${f}T00:00:00Z`) + n * MS_DIA).toISOString().slice(0, 10);

export function lunesDe(fecha: string): string {
  const dia = new Date(`${fecha}T00:00:00Z`).getUTCDay() || 7;
  return sumarDias(fecha, 1 - dia);
}

export const diasDeLaSemana = (lunes: string) => Array.from({ length: 7 }, (_, i) => sumarDias(lunes, i));
export const siguienteLunes = (lunes: string) => sumarDias(lunes, 7);
export const lunesAnterior = (lunes: string) => sumarDias(lunes, -7);

/** "2026-W53": semana ISO (el jueves define el año). */
export function semanaIso(fecha: string): string {
  const jueves = sumarDias(lunesDe(fecha), 3);
  const anio = Number(jueves.slice(0, 4));
  const primerJueves = sumarDias(lunesDe(`${anio}-01-04`), 3);
  const n = Math.round((Date.parse(`${jueves}T00:00:00Z`) - Date.parse(`${primerJueves}T00:00:00Z`)) / (7 * MS_DIA)) + 1;
  return `${anio}-W${String(n).padStart(2, '0')}`;
}

/** Instante (ms) en que cierra la semana: el lunes siguiente a las 00:00 locales. */
export function finDeSemanaMs(lunes: string, zona: Zona): number {
  return zona.aUtc(siguienteLunes(lunes));
}

/** Lunes de las semanas que ya cerraron en `hastaMs`, desde `desdeLunes`, en orden. */
export function semanasCerradas(desdeLunes: string, hastaMs: number, zona: Zona, maximo = 520): string[] {
  const salida: string[] = [];
  for (let l = desdeLunes; salida.length < maximo && finDeSemanaMs(l, zona) <= hastaMs; l = siguienteLunes(l)) salida.push(l);
  return salida;
}
