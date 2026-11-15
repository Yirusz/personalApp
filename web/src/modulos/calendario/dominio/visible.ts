/** Lo que una vista del calendario dibuja: ocurrencias propias o elementos de otros módulos. */
import type { ColorCategorico } from '../../../nucleo/dominio/agenda';

interface Comun {
  /** Único entre todo lo visible: `<eventoId>|<fecha>` o `<modulo>:<id>`. */
  id: string;
  titulo: string;
  color?: ColorCategorico;
  todoElDia: boolean;
  /** Instantes UTC (ms). Todo el día: medianoche local del primer día → medianoche tras el último. */
  inicioMs: number;
  finMs: number;
  /** Días civiles (zona del usuario) que cubre, inclusivos. */
  fechaInicio: string;
  fechaFin: string;
  /** Sin duración (vencimiento). */
  puntual: boolean;
  hecho: boolean;
}

export interface Ocurrencia extends Comun {
  fuente: 'propio';
  eventoId: string;
  /** Fecha civil ORIGINAL de la ocurrencia (clave de excepciones, cumplimientos y avisos). */
  clave: string;
  lugar: string;
  notas: string;
  recurrente: boolean;
  modificada: boolean;
  compromiso: boolean;
  cumplida: boolean;
  recordatorios: readonly number[];
}

export interface ElementoExterno extends Comun {
  fuente: 'externo';
  /** `<modulo>:<id>` */
  clave: string;
  /** Id del módulo de origen. */
  origen: string;
  /** Ruta interna del elemento en su módulo, si la publicó. */
  ruta?: string;
}

export type ElementoVisible = Ocurrencia | ElementoExterno;

export interface Rango {
  desdeMs: number;
  hastaMs: number;
}

export const seSolapa = (e: { inicioMs: number; finMs: number; puntual: boolean }, r: Rango): boolean =>
  e.puntual ? e.inicioMs >= r.desdeMs && e.inicioMs < r.hastaMs : e.inicioMs < r.hastaMs && e.finMs > r.desdeMs;

export const porInicio = (a: ElementoVisible, b: ElementoVisible): number =>
  a.inicioMs - b.inicioMs || Number(b.todoElDia) - Number(a.todoElDia) || a.id.localeCompare(b.id);
