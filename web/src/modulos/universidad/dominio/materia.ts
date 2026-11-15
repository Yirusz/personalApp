/** Agregado Materia (docs/dominio.md §2). Objetos inmutables. */
import { COLORES_CATEGORICOS, esColorCategorico, type ColorCategorico } from '../../../nucleo/dominio/agenda';
import { ColorInvalido, CreditosInvalidos, MateriaRepetida, NombreDeMateriaInvalido, PeriodoInvalido, TextoInvalido, EstadoNoPermite } from './errores';

export const NOMBRE_MAX = 60;
export const PROFESOR_MAX = 80;
export const PERIODO_MAX = 20;
export const CREDITOS_MAX = 10;
export const COLORES_DE_MATERIA = COLORES_CATEGORICOS;
export type ColorDeMateria = ColorCategorico;

export interface Materia {
  readonly id: string;
  readonly nombre: string;
  readonly profesor: string;
  readonly color: ColorDeMateria;
  /** Periodo académico, p. ej. "2026-2". */
  readonly periodo: string;
  readonly creditos: number | null;
  readonly archivada: boolean;
  readonly creadaEn: string;
  readonly actualizadaEn: string;
}

export interface DatosDeMateria {
  nombre: string;
  profesor: string;
  color: ColorDeMateria;
  periodo: string;
  creditos: number | null;
}

const limpiar = (t: string) => (t ?? '').normalize('NFC').trim().replace(/\s+/g, ' ');

export function nombreDeMateria(texto: string): string {
  const v = limpiar(texto);
  if (!v) throw new NombreDeMateriaInvalido('vacio', NOMBRE_MAX);
  if (v.length > NOMBRE_MAX) throw new NombreDeMateriaInvalido('largo', NOMBRE_MAX);
  return v;
}

function profesor(texto: string): string {
  const v = limpiar(texto);
  if (v.length > PROFESOR_MAX) throw new TextoInvalido('profesor', 'largo', PROFESOR_MAX);
  return v;
}

export function periodoAcademico(texto: string): string {
  const v = limpiar(texto);
  if (!v) throw new PeriodoInvalido('vacio', PERIODO_MAX);
  if (v.length > PERIODO_MAX) throw new PeriodoInvalido('largo', PERIODO_MAX);
  return v;
}

/** Semestre de una fecha civil: enero–junio = 1, julio–diciembre = 2. */
export function periodoSugerido(fecha: string): string {
  return `${fecha.slice(0, 4)}-${Number(fecha.slice(5, 7)) <= 6 ? 1 : 2}`;
}

const claveDeNombre = (nombre: string) => nombreDeMateria(nombre).toLocaleLowerCase('es-CO');

/** Nombre único entre las materias ACTIVAS del mismo periodo (lo verifica el caso de uso). */
export function asegurarNombreUnico(nombre: string, periodo: string, materias: readonly Materia[], exceptoId?: string): void {
  const clave = claveDeNombre(nombre);
  const p = periodoAcademico(periodo).toLocaleLowerCase('es-CO');
  if (materias.some((m) => !m.archivada && m.id !== exceptoId && m.periodo.toLocaleLowerCase('es-CO') === p && claveDeNombre(m.nombre) === clave)) {
    throw new MateriaRepetida(`Ya existe "${nombre}" en ${periodo}`);
  }
}

function validar(d: DatosDeMateria): DatosDeMateria {
  if (!esColorCategorico(d.color)) throw new ColorInvalido(`Color fuera de la paleta: ${String(d.color)}`);
  if (d.creditos !== null && (!Number.isInteger(d.creditos) || d.creditos < 0 || d.creditos > CREDITOS_MAX)) throw new CreditosInvalidos('Créditos fuera de 0–10');
  return { nombre: nombreDeMateria(d.nombre), profesor: profesor(d.profesor), color: d.color, periodo: periodoAcademico(d.periodo), creditos: d.creditos };
}

export function crearMateria(d: DatosDeMateria & { id: string }, ahora: Date): Materia {
  const instante = ahora.toISOString();
  return { id: d.id, ...validar(d), archivada: false, creadaEn: instante, actualizadaEn: instante };
}

export function editarMateria(m: Materia, d: DatosDeMateria, ahora: Date): Materia {
  return { ...m, ...validar(d), actualizadaEn: ahora.toISOString() };
}

export function archivar(m: Materia, ahora: Date): Materia {
  if (m.archivada) throw new EstadoNoPermite('La materia ya está archivada');
  return { ...m, archivada: true, actualizadaEn: ahora.toISOString() };
}

export function restaurar(m: Materia, ahora: Date): Materia {
  if (!m.archivada) throw new EstadoNoPermite('La materia no está archivada');
  return { ...m, archivada: false, actualizadaEn: ahora.toISOString() };
}

/** Lee lo guardado por versiones anteriores (sin profesor ni periodo). */
export function materiaDesdeAlmacen(v: unknown): Materia {
  const m = v as Partial<Materia> & Pick<Materia, 'id' | 'nombre' | 'color' | 'creadaEn'>;
  return {
    id: m.id,
    nombre: m.nombre,
    profesor: m.profesor ?? '',
    color: m.color,
    periodo: m.periodo ?? periodoSugerido(m.creadaEn.slice(0, 10)),
    creditos: m.creditos ?? null,
    archivada: m.archivada ?? false,
    creadaEn: m.creadaEn,
    actualizadaEn: m.actualizadaEn ?? m.creadaEn,
  };
}
