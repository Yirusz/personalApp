/** E4: cuánto se estudió hoy y esta semana (lunes a domingo, día civil de Bogotá), por vínculo. */
import type { Vinculo } from '../../../nucleo/dominio/fichas';
import type { SesionTerminada } from './sesion';

export interface MinutosPorVinculo {
  vinculo: Vinculo | null;
  minutos: number;
}

export interface Resumen {
  hoy: { minutos: number; pomodoros: number; porVinculo: MinutosPorVinculo[] };
  semana: { desde: string; minutos: number; dias: { fecha: string; minutos: number }[]; porVinculo: MinutosPorVinculo[] };
}

const MS_DIA = 86_400_000;
const sumarDias = (fecha: string, n: number) => new Date(Date.parse(`${fecha}T00:00:00Z`) + n * MS_DIA).toISOString().slice(0, 10);

export function lunesDe(fecha: string): string {
  const dia = new Date(`${fecha}T00:00:00Z`).getUTCDay() || 7;
  return sumarDias(fecha, 1 - dia);
}

/** Cuentan solo los focos completados (un Pomodoro); los descansos y lo interrumpido, no. */
export const cuenta = (s: SesionTerminada) => s.fase === 'foco' && s.estado === 'completada';

function porVinculo(sesiones: readonly SesionTerminada[]): MinutosPorVinculo[] {
  const mapa = new Map<string, MinutosPorVinculo>();
  for (const s of sesiones) {
    const clave = s.vinculo ? `${s.vinculo.tipo}|${s.vinculo.id}` : '';
    const actual = mapa.get(clave) ?? { vinculo: s.vinculo, minutos: 0 };
    actual.minutos += s.minutosEfectivos;
    mapa.set(clave, actual);
  }
  return [...mapa.values()].sort((a, b) => b.minutos - a.minutos);
}

export function resumen(sesiones: readonly SesionTerminada[], hoy: string): Resumen {
  const desde = lunesDe(hoy);
  const hasta = sumarDias(desde, 6);
  const utiles = sesiones.filter(cuenta);
  const deHoy = utiles.filter((s) => s.dia === hoy);
  const deSemana = utiles.filter((s) => s.dia >= desde && s.dia <= hasta);
  const total = (l: readonly SesionTerminada[]) => l.reduce((n, s) => n + s.minutosEfectivos, 0);
  return {
    hoy: { minutos: total(deHoy), pomodoros: deHoy.length, porVinculo: porVinculo(deHoy) },
    semana: {
      desde,
      minutos: total(deSemana),
      dias: Array.from({ length: 7 }, (_, i) => {
        const fecha = sumarDias(desde, i);
        return { fecha, minutos: total(deSemana.filter((s) => s.dia === fecha)) };
      }),
      porVinculo: porVinculo(deSemana),
    },
  };
}
