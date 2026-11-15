/**
 * Conversión entre hora civil de una zona IANA y instantes UTC, sin depender de
 * la zona del dispositivo. Pura (solo usa `Intl`, incluido en todos los
 * navegadores y en Node), por eso vive en el dominio del núcleo y la pueden usar
 * los dominios de los módulos (p. ej. la recurrencia del Calendario).
 */

export const MS_MINUTO = 60_000;
export const MS_DIA = 86_400_000;

/** Fecha civil `AAAA-MM-DD` + minutos desde la medianoche (0–1439). */
export interface HoraCivil {
  fecha: string;
  minutos: number;
}

export interface Zona {
  readonly nombre: string;
  /** Instante UTC (ms) de una hora civil en la zona. Si la hora no existe (cambio de horario), se corre hacia adelante. */
  aUtc(fecha: string, minutos?: number): number;
  /** Hora civil en la zona de un instante UTC (ms). */
  aCivil(ms: number): HoraCivil;
  /** Desfase de la zona respecto a UTC en ese instante, en ms (Bogotá: −5 h). */
  desfase(ms: number): number;
}

const PATRON_FECHA = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Componentes de una fecha civil válida, o `null` (rechaza 2026-02-30). */
export function partesDeFecha(fecha: string): { a: number; m: number; d: number } | null {
  const r = PATRON_FECHA.exec(fecha);
  if (!r) return null;
  const [a, m, d] = [Number(r[1]), Number(r[2]), Number(r[3])];
  const dt = new Date(Date.UTC(a, m - 1, d));
  return dt.getUTCFullYear() === a && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d ? { a, m, d } : null;
}

export function esFechaCivil(valor: unknown): valor is string {
  return typeof valor === 'string' && partesDeFecha(valor) !== null;
}

const cache = new Map<string, Zona>();

export function crearZona(nombre: string): Zona {
  const existente = cache.get(nombre);
  if (existente) return existente;
  const formato = new Intl.DateTimeFormat('en-US', {
    timeZone: nombre,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const comoUtc = (ms: number): number => {
    const p: Record<string, number> = {};
    for (const { type, value } of formato.formatToParts(new Date(ms))) p[type] = Number(value);
    return Date.UTC(p.year!, p.month! - 1, p.day!, p.hour!, p.minute!, p.second!);
  };
  const desfase = (ms: number) => comoUtc(ms) - Math.floor(ms / 1000) * 1000;
  const zona: Zona = {
    nombre,
    desfase,
    aUtc(fecha, minutos = 0) {
      const p = partesDeFecha(fecha);
      if (!p) throw new RangeError(`Fecha civil inválida: ${fecha}`);
      const supuesto = Date.UTC(p.a, p.m - 1, p.d) + minutos * MS_MINUTO;
      // Dos pasadas: el desfase se evalúa cerca del instante real.
      const primera = supuesto - desfase(supuesto);
      return supuesto - desfase(primera);
    },
    aCivil(ms) {
      const local = new Date(comoUtc(ms));
      return {
        fecha: local.toISOString().slice(0, 10),
        minutos: local.getUTCHours() * 60 + local.getUTCMinutes(),
      };
    },
  };
  cache.set(nombre, zona);
  return zona;
}

/** ¿La zona tiene el mismo desfase todo el año (sin horario de verano)? */
export function tieneDesfaseFijo(zona: Zona, anio: number): boolean {
  return zona.desfase(Date.UTC(anio, 0, 15)) === zona.desfase(Date.UTC(anio, 6, 15));
}
