/**
 * Agregado Trabajo (antes "Entregable"): tarea, taller, quiz, parcial, proyecto o
 * exposición con fecha de entrega. Las subtareas viven dentro del agregado.
 *
 * Transiciones explícitas:
 *   pendiente → enProgreso → entregado → calificado
 *   pendiente | enProgreso → entregado (directo) | cancelado
 *   entregado | calificado | cancelado → (reabrir, deliberado) → enProgreso
 * Invariantes:
 * - `entregadoEn` existe solo en entregado/calificado; `nota` solo en calificado.
 * - Tipo y peso no cambian estando entregado o calificado (la XP depende de ellos).
 * - Un trabajo cancelado no recibe subtareas ni cambios de fecha.
 */
import type { ElementoDeAgenda } from '../../../nucleo/dominio/agenda';
import { EstadoNoPermite, FechaInvalida, MateriaArchivadaSinTrabajos, SubtareaInvalida, TextoInvalido, TipoBloqueado, TituloInvalido } from './errores';
import type { ColorDeMateria, Materia } from './materia';
import { nota as validarNota, peso as validarPeso } from './nota';

export const TITULO_MAX = 120;
export const DESCRIPCION_MAX = 2000;
export const SUBTAREA_MAX = 200;
export const SUBTAREAS_MAX = 50;
export const TIPOS = ['tarea', 'taller', 'quiz', 'parcial', 'proyecto', 'exposicion'] as const;
export const PRIORIDADES = ['baja', 'media', 'alta'] as const;
export const ESTADOS = ['pendiente', 'enProgreso', 'entregado', 'calificado', 'cancelado'] as const;

export type TipoDeTrabajo = (typeof TIPOS)[number];
export type Prioridad = (typeof PRIORIDADES)[number];
export type EstadoDeTrabajo = (typeof ESTADOS)[number];
export type Accion = 'iniciar' | 'entregar' | 'calificar' | 'cancelar' | 'reabrir';

export interface Subtarea {
  readonly id: string;
  readonly texto: string;
  readonly hecha: boolean;
}

export interface Trabajo {
  readonly id: string;
  readonly materiaId: string;
  readonly titulo: string;
  readonly tipo: TipoDeTrabajo;
  readonly descripcion: string;
  /** Fecha y hora límite, instante UTC ISO 8601. */
  readonly venceEn: string;
  readonly prioridad: Prioridad;
  /** Peso porcentual en décimas de punto (125 = 12,5 %), o null. */
  readonly peso: number | null;
  readonly estado: EstadoDeTrabajo;
  readonly subtareas: readonly Subtarea[];
  /** Fecha real de entrega (entregado/calificado). */
  readonly entregadoEn?: string;
  /** Nota en décimas, 0–50 (calificado). */
  readonly nota?: number;
  readonly creadoEn: string;
  readonly actualizadoEn: string;
}

export const esActivo = (estado: EstadoDeTrabajo) => estado === 'pendiente' || estado === 'enProgreso';

const MS_HORA = 3_600_000;
const limpiar = (t: string) => (t ?? '').normalize('NFC').trim();

function deCatalogo<T extends string>(catalogo: readonly T[], valor: unknown, nombre: string): T {
  if (!(catalogo as readonly unknown[]).includes(valor)) throw new RangeError(`${nombre} desconocido: ${String(valor)}`);
  return valor as T;
}

export function titulo(texto: string): string {
  const v = limpiar(texto).replace(/\s+/g, ' ');
  if (!v) throw new TituloInvalido('vacio', TITULO_MAX);
  if (v.length > TITULO_MAX) throw new TituloInvalido('largo', TITULO_MAX);
  return v;
}

function descripcion(texto: string): string {
  const v = limpiar(texto);
  if (v.length > DESCRIPCION_MAX) throw new TextoInvalido('descripcion', 'largo', DESCRIPCION_MAX);
  return v;
}

export function instante(valor: string): string {
  const ms = Date.parse(valor);
  if (!/^\d{4}-\d{2}-\d{2}T/.test(valor) || Number.isNaN(ms)) throw new FechaInvalida(`Fecha inválida: ${valor}`);
  return new Date(ms).toISOString();
}

function exigir(t: Trabajo, permitidos: readonly EstadoDeTrabajo[], accion: string): void {
  if (!permitidos.includes(t.estado)) throw new EstadoNoPermite(`No se puede ${accion} un trabajo ${t.estado}`);
}

const tocar = (t: Trabajo, ahora: Date, cambios: Partial<Trabajo>): Trabajo => ({ ...t, ...cambios, actualizadoEn: ahora.toISOString() });

export interface DatosDeTrabajo {
  id: string;
  materia: Materia;
  titulo: string;
  tipo: TipoDeTrabajo;
  descripcion: string;
  venceEn: string;
  prioridad: Prioridad;
  peso: number | null;
}

export function registrarTrabajo(d: DatosDeTrabajo, ahora: Date): { trabajo: Trabajo; antelacionHoras: number } {
  if (d.materia.archivada) throw new MateriaArchivadaSinTrabajos('La materia está archivada');
  const venceEn = instante(d.venceEn);
  const creadoEn = ahora.toISOString();
  const trabajo: Trabajo = {
    id: d.id,
    materiaId: d.materia.id,
    titulo: titulo(d.titulo),
    tipo: deCatalogo(TIPOS, d.tipo, 'Tipo'),
    descripcion: descripcion(d.descripcion),
    venceEn,
    prioridad: deCatalogo(PRIORIDADES, d.prioridad, 'Prioridad'),
    peso: validarPeso(d.peso),
    estado: 'pendiente',
    subtareas: [],
    creadoEn,
    actualizadoEn: creadoEn,
  };
  return { trabajo, antelacionHoras: Math.floor((Date.parse(venceEn) - ahora.getTime()) / MS_HORA) };
}

export interface CambiosDeTrabajo {
  titulo?: string;
  tipo?: TipoDeTrabajo;
  descripcion?: string;
  prioridad?: Prioridad;
  peso?: number | null;
}

export function editarTrabajo(t: Trabajo, c: CambiosDeTrabajo, ahora: Date): Trabajo {
  const tipo = c.tipo === undefined ? t.tipo : deCatalogo(TIPOS, c.tipo, 'Tipo');
  const nuevoPeso = c.peso === undefined ? t.peso : validarPeso(c.peso);
  if ((tipo !== t.tipo || nuevoPeso !== t.peso) && (t.estado === 'entregado' || t.estado === 'calificado')) {
    throw new TipoBloqueado('Tipo y peso no cambian una vez entregado');
  }
  return tocar(t, ahora, {
    titulo: c.titulo === undefined ? t.titulo : titulo(c.titulo),
    tipo,
    descripcion: c.descripcion === undefined ? t.descripcion : descripcion(c.descripcion),
    prioridad: c.prioridad === undefined ? t.prioridad : deCatalogo(PRIORIDADES, c.prioridad, 'Prioridad'),
    peso: nuevoPeso,
  });
}

export function reprogramar(t: Trabajo, venceEn: string, ahora: Date): { trabajo: Trabajo; venceEnAnterior: string } {
  exigir(t, ['pendiente', 'enProgreso'], 'reprogramar');
  return { trabajo: tocar(t, ahora, { venceEn: instante(venceEn) }), venceEnAnterior: t.venceEn };
}

export function iniciar(t: Trabajo, ahora: Date): Trabajo {
  exigir(t, ['pendiente'], 'iniciar');
  return tocar(t, ahora, { estado: 'enProgreso' });
}

export interface ResultadoDeEntrega {
  trabajo: Trabajo;
  aTiempo: boolean;
  minutosDesdeCreacion: number;
}

/** Guarda la fecha real (del reloj inyectado). "A tiempo" = fecha real ≤ fecha límite. */
export function entregar(t: Trabajo, ahora: Date): ResultadoDeEntrega {
  exigir(t, ['pendiente', 'enProgreso'], 'entregar');
  const trabajo = tocar(t, ahora, { estado: 'entregado', entregadoEn: ahora.toISOString() });
  return { trabajo, aTiempo: aTiempo(trabajo)!, minutosDesdeCreacion: Math.max(0, Math.floor((ahora.getTime() - Date.parse(t.creadoEn)) / 60_000)) };
}

/** Registra (o corrige) la nota en décimas. */
export function calificar(t: Trabajo, decimas: number, ahora: Date): Trabajo {
  exigir(t, ['entregado', 'calificado'], 'calificar');
  return tocar(t, ahora, { estado: 'calificado', nota: validarNota(decimas) });
}

export function cancelar(t: Trabajo, ahora: Date): Trabajo {
  exigir(t, ['pendiente', 'enProgreso'], 'cancelar');
  return tocar(t, ahora, { estado: 'cancelado' });
}

/** Acción deliberada: vuelve a "en progreso" y borra la fecha real y la nota. */
export function reabrir(t: Trabajo, ahora: Date): Trabajo {
  exigir(t, ['entregado', 'calificado', 'cancelado'], 'reabrir');
  const { entregadoEn: _e, nota: _n, ...resto } = t;
  return { ...resto, estado: 'enProgreso', actualizadoEn: ahora.toISOString() };
}

export function transicionesPosibles(t: Trabajo): Accion[] {
  switch (t.estado) {
    case 'pendiente':
      return ['iniciar', 'entregar', 'cancelar'];
    case 'enProgreso':
      return ['entregar', 'cancelar'];
    case 'entregado':
      return ['calificar', 'reabrir'];
    case 'calificado':
      return ['calificar', 'reabrir'];
    case 'cancelado':
      return ['reabrir'];
  }
}

/** true/false si ya se entregó; undefined si no. */
export function aTiempo(t: Trabajo): boolean | undefined {
  return t.entregadoEn === undefined ? undefined : Date.parse(t.entregadoEn) <= Date.parse(t.venceEn);
}

export function estaVencido(t: Trabajo, ahora: Date): boolean {
  return esActivo(t.estado) && Date.parse(t.venceEn) < ahora.getTime();
}

// ---- Subtareas ----

function textoDeSubtarea(texto: string): string {
  const v = limpiar(texto).replace(/\s+/g, ' ');
  if (!v) throw new SubtareaInvalida('vacia');
  if (v.length > SUBTAREA_MAX) throw new SubtareaInvalida('larga', SUBTAREA_MAX);
  return v;
}

function conSubtarea(t: Trabajo, id: string, ahora: Date, fn: (s: Subtarea) => Subtarea | null): Trabajo {
  if (!t.subtareas.some((s) => s.id === id)) throw new SubtareaInvalida('noExiste');
  const subtareas = t.subtareas.flatMap((s) => (s.id === id ? (fn(s) ?? []) : [s]));
  return tocar(t, ahora, { subtareas });
}

export function agregarSubtarea(t: Trabajo, id: string, texto: string, ahora: Date): Trabajo {
  if (t.estado === 'cancelado') throw new EstadoNoPermite('Trabajo cancelado');
  const limpio = textoDeSubtarea(texto);
  if (t.subtareas.length >= SUBTAREAS_MAX) throw new SubtareaInvalida('demasiadas', SUBTAREAS_MAX);
  return tocar(t, ahora, { subtareas: [...t.subtareas, { id, texto: limpio, hecha: false }] });
}

export function marcarSubtarea(t: Trabajo, id: string, hecha: boolean, ahora: Date): Trabajo {
  return conSubtarea(t, id, ahora, (s) => ({ ...s, hecha }));
}

export function editarSubtarea(t: Trabajo, id: string, texto: string, ahora: Date): Trabajo {
  const limpio = textoDeSubtarea(texto);
  return conSubtarea(t, id, ahora, (s) => ({ ...s, texto: limpio }));
}

export function quitarSubtarea(t: Trabajo, id: string, ahora: Date): Trabajo {
  return conSubtarea(t, id, ahora, () => null);
}

export function progreso(t: Trabajo): { hechas: number; total: number } {
  return { hechas: t.subtareas.filter((s) => s.hecha).length, total: t.subtareas.length };
}

// ---- Integración y datos guardados ----

/** Lenguaje publicado para el calendario (vencimiento puntual con ruta al trabajo). */
export function elementoDeAgenda(t: Trabajo, color: ColorDeMateria): ElementoDeAgenda {
  return {
    id: t.id,
    titulo: t.titulo,
    inicio: t.venceEn,
    tipo: 'vencimiento',
    estado: t.estado === 'entregado' || t.estado === 'calificado' ? 'hecho' : 'pendiente',
    color,
    ruta: `/universidad/trabajos/${t.id}`,
  };
}

const TIPO_ANTERIOR: Record<string, TipoDeTrabajo> = { tarea: 'tarea', trabajo: 'taller', parcial: 'parcial', otro: 'tarea' };
const ESTADO_ANTERIOR: Record<string, EstadoDeTrabajo> = { pendiente: 'pendiente', enCurso: 'enProgreso', completado: 'entregado' };

/** Lee lo guardado por versiones anteriores ("Entregable" de la iteración 1). */
export function trabajoDesdeAlmacen(v: unknown): Trabajo {
  const r = v as Record<string, unknown>;
  const tipo = (TIPOS as readonly string[]).includes(r.tipo as string) ? (r.tipo as TipoDeTrabajo) : (TIPO_ANTERIOR[r.tipo as string] ?? 'tarea');
  const estado = (ESTADOS as readonly string[]).includes(r.estado as string) ? (r.estado as EstadoDeTrabajo) : (ESTADO_ANTERIOR[r.estado as string] ?? 'pendiente');
  const entregadoEn = (r.entregadoEn ?? r.completadoEn) as string | undefined;
  return {
    id: r.id as string,
    materiaId: r.materiaId as string,
    titulo: r.titulo as string,
    tipo,
    descripcion: (r.descripcion as string | undefined) ?? '',
    venceEn: r.venceEn as string,
    prioridad: (r.prioridad as Prioridad | undefined) ?? 'media',
    peso: (r.peso as number | null | undefined) ?? null,
    estado,
    subtareas: (r.subtareas as Subtarea[] | undefined) ?? [],
    ...(entregadoEn && (estado === 'entregado' || estado === 'calificado') ? { entregadoEn } : {}),
    ...(typeof r.nota === 'number' && estado === 'calificado' ? { nota: r.nota } : {}),
    creadoEn: r.creadoEn as string,
    actualizadoEn: (r.actualizadoEn as string | undefined) ?? (r.creadoEn as string),
  };
}
