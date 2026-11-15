/**
 * Agregado Entregable: trabajo, tarea, parcial u otro con fecha de entrega
 * (docs/dominio.md §2). Referencia a su Materia solo por id.
 *
 * Estados: pendiente → enCurso → completado; completado → (reabrir) → enCurso.
 * Invariantes:
 * - La talla no cambia una vez en curso o completado (evita inflar la XP).
 * - `completadoEn` existe si y solo si el estado es completado.
 * - No se completa dos veces sin reabrir.
 */
import type { ElementoDeAgenda } from '../../../nucleo/dominio/agenda';
import {
  EntregableYaCompletado,
  FechaInvalida,
  MateriaArchivadaSinEntregables,
  TallaBloqueada,
  TituloInvalido,
  TransicionInvalida,
} from './errores';
import type { ColorDeMateria, Materia } from './materia';

export const TITULO_MAX = 120;
export const TIPOS = ['tarea', 'trabajo', 'parcial', 'otro'] as const;
export const PRIORIDADES = ['baja', 'media', 'alta'] as const;
export const TALLAS = ['S', 'M', 'L'] as const;
export const ESTADOS = ['pendiente', 'enCurso', 'completado'] as const;

export type TipoDeEntregable = (typeof TIPOS)[number];
export type Prioridad = (typeof PRIORIDADES)[number];
export type Talla = (typeof TALLAS)[number];
export type EstadoDeEntregable = (typeof ESTADOS)[number];

export interface Entregable {
  readonly id: string;
  readonly materiaId: string;
  readonly titulo: string;
  readonly tipo: TipoDeEntregable;
  /** Instante UTC ISO 8601 de la fecha y hora de entrega. */
  readonly venceEn: string;
  readonly prioridad: Prioridad;
  readonly talla: Talla;
  readonly estado: EstadoDeEntregable;
  readonly creadoEn: string;
  readonly actualizadoEn: string;
  readonly completadoEn?: string;
}

const MS_HORA = 3_600_000;
const MS_MINUTO = 60_000;

function deCatalogo<T extends string>(catalogo: readonly T[], valor: unknown, nombre: string): T {
  if (!(catalogo as readonly unknown[]).includes(valor)) throw new RangeError(`${nombre} desconocido: ${String(valor)}`);
  return valor as T;
}

/** VO Titulo: sin espacios extremos, 1–120 caracteres. */
export function titulo(texto: string): string {
  const limpio = texto.normalize('NFC').trim().replace(/\s+/g, ' ');
  if (limpio.length === 0) throw new TituloInvalido('vacio', TITULO_MAX);
  if (limpio.length > TITULO_MAX) throw new TituloInvalido('largo', TITULO_MAX);
  return limpio;
}

/** VO Instante: cualquier ISO 8601 válido, normalizado a UTC con milisegundos. */
export function instante(valor: string): string {
  const ms = Date.parse(valor);
  if (!/^\d{4}-\d{2}-\d{2}T/.test(valor) || Number.isNaN(ms)) throw new FechaInvalida(`Fecha inválida: ${valor}`);
  return new Date(ms).toISOString();
}

export interface DatosDeEntregable {
  id: string;
  /** La materia completa: se necesita para verificar que no esté archivada. */
  materia: Materia;
  titulo: string;
  tipo: TipoDeEntregable;
  venceEn: string;
  prioridad: Prioridad;
  talla: Talla;
}

export function registrarEntregable(datos: DatosDeEntregable, ahora: Date): { entregable: Entregable; antelacionHoras: number } {
  if (datos.materia.archivada) throw new MateriaArchivadaSinEntregables('La materia está archivada');
  const venceEn = instante(datos.venceEn);
  const creadoEn = ahora.toISOString();
  const entregable: Entregable = {
    id: datos.id,
    materiaId: datos.materia.id,
    titulo: titulo(datos.titulo),
    tipo: deCatalogo(TIPOS, datos.tipo, 'Tipo'),
    venceEn,
    prioridad: deCatalogo(PRIORIDADES, datos.prioridad, 'Prioridad'),
    talla: deCatalogo(TALLAS, datos.talla, 'Talla'),
    estado: 'pendiente',
    creadoEn,
    actualizadoEn: creadoEn,
  };
  // Horas completas de antelación (negativas si se registra algo ya vencido). El RPG decide qué hacer con ellas.
  const antelacionHoras = Math.floor((Date.parse(venceEn) - ahora.getTime()) / MS_HORA);
  return { entregable, antelacionHoras };
}

export function iniciar(e: Entregable, ahora: Date): Entregable {
  if (e.estado !== 'pendiente') throw new TransicionInvalida(`No se puede iniciar un entregable en estado ${e.estado}`);
  return { ...e, estado: 'enCurso', actualizadoEn: ahora.toISOString() };
}

export interface ResultadoDeCompletar {
  entregable: Entregable;
  aTiempo: boolean;
  minutosDesdeCreacion: number;
}

export function completar(e: Entregable, ahora: Date): ResultadoDeCompletar {
  if (e.estado === 'completado') throw new EntregableYaCompletado('El entregable ya está completado');
  const completadoEn = ahora.toISOString();
  return {
    entregable: { ...e, estado: 'completado', completadoEn, actualizadoEn: completadoEn },
    aTiempo: ahora.getTime() <= Date.parse(e.venceEn),
    minutosDesdeCreacion: Math.max(0, Math.floor((ahora.getTime() - Date.parse(e.creadoEn)) / MS_MINUTO)),
  };
}

/** Vuelve a "en curso" (ya se había empezado): la talla sigue bloqueada. */
export function reabrir(e: Entregable, ahora: Date): Entregable {
  if (e.estado !== 'completado') throw new TransicionInvalida('Solo se reabre un entregable completado');
  const { completadoEn: _descartado, ...resto } = e;
  return { ...resto, estado: 'enCurso', actualizadoEn: ahora.toISOString() };
}

export function reprogramar(e: Entregable, venceEn: string, ahora: Date): { entregable: Entregable; venceEnAnterior: string } {
  if (e.estado === 'completado') throw new EntregableYaCompletado('Reabre el entregable antes de cambiar su fecha');
  return { entregable: { ...e, venceEn: instante(venceEn), actualizadoEn: ahora.toISOString() }, venceEnAnterior: e.venceEn };
}

export interface CambiosDeEntregable {
  titulo?: string;
  tipo?: TipoDeEntregable;
  prioridad?: Prioridad;
  talla?: Talla;
}

export function editar(e: Entregable, cambios: CambiosDeEntregable, ahora: Date): Entregable {
  const talla = cambios.talla === undefined ? e.talla : deCatalogo(TALLAS, cambios.talla, 'Talla');
  if (talla !== e.talla && e.estado !== 'pendiente') throw new TallaBloqueada('La talla no cambia una vez empezado');
  return {
    ...e,
    titulo: cambios.titulo === undefined ? e.titulo : titulo(cambios.titulo),
    tipo: cambios.tipo === undefined ? e.tipo : deCatalogo(TIPOS, cambios.tipo, 'Tipo'),
    prioridad: cambios.prioridad === undefined ? e.prioridad : deCatalogo(PRIORIDADES, cambios.prioridad, 'Prioridad'),
    talla,
    actualizadoEn: ahora.toISOString(),
  };
}

export function estaVencido(e: Entregable, ahora: Date): boolean {
  return e.estado !== 'completado' && Date.parse(e.venceEn) < ahora.getTime();
}

/** Lenguaje publicado para el Calendario: un vencimiento puntual. */
export function elementoDeAgenda(e: Entregable, color: ColorDeMateria, eliminado = false): ElementoDeAgenda {
  return {
    id: e.id,
    titulo: e.titulo,
    inicio: e.venceEn,
    tipo: 'vencimiento',
    estado: eliminado ? 'eliminado' : e.estado === 'completado' ? 'hecho' : 'pendiente',
    color,
  };
}
