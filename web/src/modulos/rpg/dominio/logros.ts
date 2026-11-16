/** R3: contadores y logros definidos en configuración. Funciones puras e idempotentes. */
import type { Contador, Logro } from './reglas';

/** Ids de los contadores que suma este evento. `yaContado(clave)` evita contar dos veces la misma entidad. */
export function sumarContadores(contadores: readonly Contador[], tipo: string, datos: Readonly<Record<string, unknown>>, yaContado: (clave: string) => boolean): string[] {
  return contadores
    .filter((c) => c.evento === tipo)
    .filter((c) => !c.donde || Object.entries(c.donde).every(([k, v]) => datos[k] === v))
    .filter((c) => {
      const clave = claveDeContador(c, datos);
      return clave === undefined || !yaContado(clave);
    })
    .map((c) => c.id);
}

/** `<contador>|<valor>` cuando el contador cuenta una vez por entidad. */
export function claveDeContador(c: Contador, datos: Readonly<Record<string, unknown>>): string | undefined {
  if (!c.unaVezPor) return undefined;
  const v = datos[c.unaVezPor];
  return typeof v === 'string' || typeof v === 'number' ? `${c.id}|${v}` : undefined;
}

export interface EstadoParaLogros {
  totales: Readonly<Record<string, number>>;
  /** Contadores del día del evento que se está procesando. */
  delDia: Readonly<Record<string, number>>;
  semanasDeRacha: number;
}

/** Logros que se cumplen y aún no estaban desbloqueados, en el orden de la configuración. */
export function logrosCumplidos(logros: readonly Logro[], e: EstadoParaLogros, desbloqueados: ReadonlySet<string>): Logro[] {
  return logros.filter(
    (l) =>
      !desbloqueados.has(l.id) &&
      l.condiciones.every((c) => ('racha' in c ? e.semanasDeRacha >= c.racha : ((c.ambito === 'dia' ? e.delDia : e.totales)[c.contador] ?? 0) >= c.minimo)),
  );
}
