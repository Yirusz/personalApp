/**
 * Textos externalizados (es-CO) y formatos con Intl.
 * Las fechas se guardan en UTC y solo se convierten a la zona del usuario al mostrarlas.
 */

import { crearZona, esFechaCivil } from '../dominio/zona-horaria';

export type Parametros = Readonly<Record<string, string | number>>;
export type Traductor = (clave: string, parametros?: Parametros) => string;

export const LOCALE = 'es-CO';
export const ZONA_HORARIA = 'America/Bogota';

/**
 * Crea la función `t`. Si `parametros.n` es número y existen `<clave>.uno` /
 * `<clave>.otro`, elige la forma plural con Intl.PluralRules.
 * Una clave inexistente se muestra como `⟦clave⟧` (visible, no rompe la app).
 */
export function crearTraductor(
  diccionario: Readonly<Record<string, string>>,
  alFaltar?: (clave: string) => void,
): Traductor {
  const plurales = new Intl.PluralRules(LOCALE);
  return (clave, parametros) => {
    let plantilla = diccionario[clave];
    if (plantilla === undefined && typeof parametros?.n === 'number') {
      const forma = plurales.select(parametros.n) === 'one' ? 'uno' : 'otro';
      plantilla = diccionario[`${clave}.${forma}`];
    }
    if (plantilla === undefined) {
      alFaltar?.(clave);
      return `⟦${clave}⟧`;
    }
    if (!parametros) return plantilla;
    return plantilla.replace(/\{(\w+)\}/g, (original, nombre: string) => {
      const valor = parametros[nombre];
      if (valor === undefined) return original;
      return typeof valor === 'number' ? new Intl.NumberFormat(LOCALE).format(valor) : valor;
    });
  };
}

export interface Formatos {
  /** "14 nov 2026" */
  fecha(instante: Date | string): string;
  /** "14 nov 2026, 7:35 p. m." */
  fechaHora(instante: Date | string): string;
  /** "7:35 p. m." */
  hora(instante: Date | string): string;
  /** "1.234,5" */
  numero(valor: number): string;
  /** Día calendario en la zona del usuario, `AAAA-MM-DD`. */
  diaLocal(instante: Date | string): string;
  /** Valor para `<input type="datetime-local">` en la zona del usuario: `AAAA-MM-DDTHH:mm`. */
  entradaLocal(instante: Date | string): string;
  /**
   * Inverso de `entradaLocal`: interpreta `AAAA-MM-DDTHH:mm[:ss]` como hora de la zona
   * del usuario (no la del dispositivo) y devuelve el instante UTC ISO, o `null` si no es válido.
   */
  desdeEntradaLocal(valor: string): string | null;
  /** "dentro de 3 horas", "mañana", "hace 2 días". */
  relativo(instante: Date | string, ahora: Date | string): string;
}

const PATRON_ENTRADA_LOCAL = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;

const UNIDADES_RELATIVAS: readonly [Intl.RelativeTimeFormatUnit, number][] = [
  ['day', 86_400_000],
  ['hour', 3_600_000],
  ['minute', 60_000],
];

export function crearFormatos(zona: string = ZONA_HORARIA): Formatos {
  const fecha = new Intl.DateTimeFormat(LOCALE, { timeZone: zona, dateStyle: 'medium' });
  const fechaHora = new Intl.DateTimeFormat(LOCALE, { timeZone: zona, dateStyle: 'medium', timeStyle: 'short' });
  const hora = new Intl.DateTimeFormat(LOCALE, { timeZone: zona, timeStyle: 'short' });
  const numero = new Intl.NumberFormat(LOCALE);
  const relativo = new Intl.RelativeTimeFormat(LOCALE, { numeric: 'auto' });
  // en-CA produce AAAA-MM-DD; solo se usa como formato técnico, no se muestra.
  const dia = new Intl.DateTimeFormat('en-CA', { timeZone: zona, year: 'numeric', month: '2-digit', day: '2-digit' });
  const civil = crearZona(zona);
  const aFecha = (v: Date | string) => (v instanceof Date ? v : new Date(v));
  const dosDigitos = (n: number) => String(n).padStart(2, '0');

  const entradaLocal = (v: Date | string): string => {
    const { fecha: f, minutos } = civil.aCivil(aFecha(v).getTime());
    return `${f}T${dosDigitos(Math.floor(minutos / 60))}:${dosDigitos(minutos % 60)}`;
  };

  return {
    fecha: (v) => fecha.format(aFecha(v)),
    fechaHora: (v) => fechaHora.format(aFecha(v)),
    hora: (v) => hora.format(aFecha(v)),
    numero: (v) => numero.format(v),
    diaLocal: (v) => dia.format(aFecha(v)),
    entradaLocal,
    desdeEntradaLocal(valor) {
      const m = PATRON_ENTRADA_LOCAL.exec(valor);
      if (!m) return null;
      const fechaCivil = `${m[1]}-${m[2]}-${m[3]}`;
      const [h, min, seg] = [Number(m[4]), Number(m[5]), Number(m[6] ?? 0)];
      if (!esFechaCivil(fechaCivil) || h > 23 || min > 59 || seg > 59) return null;
      const ms = civil.aUtc(fechaCivil, h * 60 + min) + seg * 1000;
      // Rechaza horas inexistentes por cambio de horario (la conversión las corre).
      if (entradaLocal(new Date(ms)) !== `${fechaCivil}T${m[4]}:${m[5]}`) return null;
      return new Date(ms).toISOString();
    },
    relativo(v, ahora) {
      const diferencia = aFecha(v).getTime() - aFecha(ahora).getTime();
      for (const [unidad, ms] of UNIDADES_RELATIVAS) {
        if (Math.abs(diferencia) >= ms || unidad === 'minute') return relativo.format(Math.round(diferencia / ms), unidad);
      }
      return relativo.format(0, 'minute');
    },
  };
}
