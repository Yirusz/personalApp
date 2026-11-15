/**
 * Textos externalizados (es-CO) y formatos con Intl.
 * Las fechas se guardan en UTC y solo se convierten a la zona del usuario al mostrarlas.
 */

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
}

export function crearFormatos(zona: string = ZONA_HORARIA): Formatos {
  const fecha = new Intl.DateTimeFormat(LOCALE, { timeZone: zona, dateStyle: 'medium' });
  const fechaHora = new Intl.DateTimeFormat(LOCALE, { timeZone: zona, dateStyle: 'medium', timeStyle: 'short' });
  const hora = new Intl.DateTimeFormat(LOCALE, { timeZone: zona, timeStyle: 'short' });
  const numero = new Intl.NumberFormat(LOCALE);
  // en-CA produce AAAA-MM-DD; solo se usa como formato técnico, no se muestra.
  const dia = new Intl.DateTimeFormat('en-CA', { timeZone: zona, year: 'numeric', month: '2-digit', day: '2-digit' });
  const aFecha = (v: Date | string) => (v instanceof Date ? v : new Date(v));
  return {
    fecha: (v) => fecha.format(aFecha(v)),
    fechaHora: (v) => fechaHora.format(aFecha(v)),
    hora: (v) => hora.format(aFecha(v)),
    numero: (v) => numero.format(v),
    diaLocal: (v) => dia.format(aFecha(v)),
  };
}
