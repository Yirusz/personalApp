/**
 * Evento de dominio: algo que ya ocurrió, nombrado en pasado.
 * `tipo` = `<modulo>.<NombreEnPasado>`, p. ej. `universidad.EntregableCompletado`.
 * Los datos son JSON plano (se guardan en IndexedDB y viajan en los respaldos).
 */
export interface EventoDeDominio<D = Record<string, unknown>> {
  /** UUIDv7: identifica el evento y define su orden. */
  readonly id: string;
  readonly tipo: string;
  /** Módulo que lo publicó. */
  readonly modulo: string;
  /** Versión del esquema de `datos` para este tipo. */
  readonly version: number;
  /** Instante UTC ISO 8601. */
  readonly ocurridoEn: string;
  readonly datos: D;
}

export const PATRON_TIPO_EVENTO = /^[a-z][a-z0-9]*\.[A-Z][A-Za-z0-9]*$/;

export function moduloDelTipo(tipo: string): string {
  return tipo.slice(0, tipo.indexOf('.'));
}
