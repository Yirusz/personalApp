/** Aritmética de fechas civiles `AAAA-MM-DD` (sin hora ni zona). Lunes = 1 … domingo = 7 (ISO 8601). */
import { MS_DIA, partesDeFecha } from '../../../nucleo/dominio/zona-horaria';

export type DiaSemana = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export const DIAS_SEMANA: readonly DiaSemana[] = [1, 2, 3, 4, 5, 6, 7];

function aMs(fecha: string): number {
  const p = partesDeFecha(fecha);
  if (!p) throw new RangeError(`Fecha civil inválida: ${fecha}`);
  return Date.UTC(p.a, p.m - 1, p.d);
}

const deMs = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export function sumarDias(fecha: string, dias: number): string {
  return deMs(aMs(fecha) + dias * MS_DIA);
}

/** b − a en días. */
export function diferenciaDias(a: string, b: string): number {
  return Math.round((aMs(b) - aMs(a)) / MS_DIA);
}

export function diaSemana(fecha: string): DiaSemana {
  const d = new Date(aMs(fecha)).getUTCDay();
  return (d === 0 ? 7 : d) as DiaSemana;
}

export function inicioDeSemana(fecha: string): string {
  return sumarDias(fecha, 1 - diaSemana(fecha));
}

export function sumarMeses(anio: number, mes: number, n: number): { anio: number; mes: number } {
  const total = anio * 12 + (mes - 1) + n;
  return { anio: Math.floor(total / 12), mes: (total % 12) + 1 };
}

export function diasDelMes(anio: number, mes: number): number {
  return new Date(Date.UTC(anio, mes, 0)).getUTCDate();
}

/** Fecha con ese día del mes, o `null` si el mes no lo tiene (31 de abril). */
export function fechaConDia(anio: number, mes: number, dia: number): string | null {
  if (dia > diasDelMes(anio, mes)) return null;
  return `${String(anio).padStart(4, '0')}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

export function componentes(fecha: string): { anio: number; mes: number; dia: number } {
  const p = partesDeFecha(fecha);
  if (!p) throw new RangeError(`Fecha civil inválida: ${fecha}`);
  return { anio: p.a, mes: p.m, dia: p.d };
}

/** Semana ISO 8601, p. ej. `2026-W47` (la semana del jueves define el año). */
export function semanaIso(fecha: string): string {
  const jueves = sumarDias(fecha, 4 - diaSemana(fecha));
  const { anio } = componentes(jueves);
  const semana = Math.floor(diferenciaDias(`${anio}-01-01`, jueves) / 7) + 1;
  return `${anio}-W${String(semana).padStart(2, '0')}`;
}

export function mismoMes(a: string, b: string): boolean {
  return a.slice(0, 7) === b.slice(0, 7);
}
