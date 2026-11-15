/**
 * Agregación de fuentes del calendario, tolerante a fallos: cada fuente se lee
 * en su propia transacción; si una falla (o tiene registros dañados) se
 * muestra el resto y un aviso con la fuente afectada.
 */
import type { AlmacenDeModulo } from '../../../nucleo/contrato';
import type { Zona } from '../../../nucleo/dominio/zona-horaria';
import type { EventoDeCalendario } from '../dominio/evento';
import { ocurrenciasEnRango } from '../dominio/expansion';
import { elementoExterno } from '../dominio/externos';
import { porInicio, type ElementoVisible, type Rango } from '../dominio/visible';
import { AGENDA, EVENTOS, type RegistroDeAgenda } from './comun';

export type IdDeFuente = 'propios' | 'externos';

interface Fuente<R> {
  id: IdDeFuente;
  almacen: string;
  expandir(registro: R, rango: Rango, zona: Zona): ElementoVisible[];
}

export const FUENTES: readonly Fuente<unknown>[] = [
  { id: 'propios', almacen: EVENTOS, expandir: (r, rango, zona) => ocurrenciasEnRango(r as EventoDeCalendario, rango, zona) },
  {
    id: 'externos',
    almacen: AGENDA,
    expandir: (r, rango, zona) => {
      const reg = r as RegistroDeAgenda;
      const x = elementoExterno(reg.origen, reg.agenda, zona);
      return (x.puntual ? x.inicioMs >= rango.desdeMs && x.inicioMs < rango.hastaMs : x.inicioMs < rango.hastaMs && x.finMs > rango.desdeMs) ? [x] : [];
    },
  },
];

export const ALMACENES_DE_FUENTES = FUENTES.map((f) => f.almacen);

export interface Lectura {
  registros: ReadonlyMap<IdDeFuente, readonly unknown[]>;
  fallos: readonly { fuente: IdDeFuente; error: unknown }[];
}

export async function leerFuentes(almacen: AlmacenDeModulo, fuentes: readonly Fuente<unknown>[] = FUENTES): Promise<Lectura> {
  const resultados = await Promise.allSettled(fuentes.map((f) => almacen.leer([f.almacen], (tx) => tx.listar<unknown>(f.almacen))));
  const registros = new Map<IdDeFuente, readonly unknown[]>();
  const fallos: { fuente: IdDeFuente; error: unknown }[] = [];
  resultados.forEach((r, i) => {
    const id = fuentes[i]!.id;
    if (r.status === 'fulfilled') registros.set(id, r.value);
    else fallos.push({ fuente: id, error: r.reason });
  });
  return { registros, fallos };
}

export interface Visibles {
  elementos: ElementoVisible[];
  /** Fuentes con problemas (no se pudo leer o hay registros dañados que se omitieron). */
  fallos: { fuente: IdDeFuente; omitidos: number; error?: unknown }[];
}

/** Expande todo lo leído para un rango. Un registro dañado se omite y cuenta como fallo de su fuente. */
export function visiblesEnRango(lectura: Lectura, rango: Rango, zona: Zona, fuentes: readonly Fuente<unknown>[] = FUENTES): Visibles {
  const elementos: ElementoVisible[] = [];
  const fallos: Visibles['fallos'] = lectura.fallos.map((f) => ({ fuente: f.fuente, omitidos: 0, error: f.error }));
  for (const fuente of fuentes) {
    let omitidos = 0;
    for (const registro of lectura.registros.get(fuente.id) ?? []) {
      try {
        elementos.push(...fuente.expandir(registro, rango, zona));
      } catch {
        omitidos++;
      }
    }
    if (omitidos > 0) fallos.push({ fuente: fuente.id, omitidos });
  }
  return { elementos: elementos.sort(porInicio), fallos };
}
