/**
 * Agregado Materia: asignatura del semestre (docs/dominio.md §2).
 * Objetos inmutables: cada operación devuelve una materia nueva.
 */
import { COLORES_CATEGORICOS, esColorCategorico, type ColorCategorico } from '../../../nucleo/dominio/agenda';
import { ColorInvalido, CreditosInvalidos, MateriaRepetida, NombreDeMateriaInvalido, TransicionInvalida } from './errores';

export const NOMBRE_MAX = 60;
export const CREDITOS_MAX = 10;
export const COLORES_DE_MATERIA = COLORES_CATEGORICOS;
export type ColorDeMateria = ColorCategorico;

export interface Materia {
  readonly id: string;
  readonly nombre: string;
  readonly color: ColorDeMateria;
  readonly creditos: number | null;
  readonly archivada: boolean;
  /** Instantes UTC ISO 8601. */
  readonly creadaEn: string;
  readonly actualizadaEn: string;
}

/** VO NombreDeMateria: sin espacios extremos ni repetidos, 1–60 caracteres. */
export function nombreDeMateria(texto: string): string {
  const limpio = texto.normalize('NFC').trim().replace(/\s+/g, ' ');
  if (limpio.length === 0) throw new NombreDeMateriaInvalido('vacio', NOMBRE_MAX);
  if (limpio.length > NOMBRE_MAX) throw new NombreDeMateriaInvalido('largo', NOMBRE_MAX);
  return limpio;
}

/** Clave para comparar nombres sin distinguir mayúsculas ni espacios. */
export function claveDeNombre(nombre: string): string {
  return nombreDeMateria(nombre).toLocaleLowerCase('es-CO');
}

function creditosValidos(valor: number | null): number | null {
  if (valor === null) return null;
  if (!Number.isInteger(valor) || valor < 0 || valor > CREDITOS_MAX) throw new CreditosInvalidos(`Créditos fuera de 0–${CREDITOS_MAX}`);
  return valor;
}

function colorValido(valor: unknown): ColorDeMateria {
  if (!esColorCategorico(valor)) throw new ColorInvalido(`Color fuera de la paleta: ${String(valor)}`);
  return valor;
}

/**
 * Invariante entre agregados: nombre único entre las materias ACTIVAS.
 * La verifica el caso de uso, que es quien conoce todas las materias.
 */
export function asegurarNombreUnico(nombre: string, activas: readonly Materia[], exceptoId?: string): void {
  const clave = claveDeNombre(nombre);
  if (activas.some((m) => !m.archivada && m.id !== exceptoId && claveDeNombre(m.nombre) === clave)) {
    throw new MateriaRepetida(`Ya existe una materia activa llamada "${nombre}"`);
  }
}

export interface DatosDeMateria {
  id: string;
  nombre: string;
  color: ColorDeMateria;
  creditos: number | null;
}

export function crearMateria(datos: DatosDeMateria, ahora: Date): Materia {
  const instante = ahora.toISOString();
  return {
    id: datos.id,
    nombre: nombreDeMateria(datos.nombre),
    color: colorValido(datos.color),
    creditos: creditosValidos(datos.creditos),
    archivada: false,
    creadaEn: instante,
    actualizadaEn: instante,
  };
}

export function renombrar(materia: Materia, nombre: string, ahora: Date): Materia {
  return { ...materia, nombre: nombreDeMateria(nombre), actualizadaEn: ahora.toISOString() };
}

export function archivar(materia: Materia, ahora: Date): Materia {
  if (materia.archivada) throw new TransicionInvalida('La materia ya está archivada');
  return { ...materia, archivada: true, actualizadaEn: ahora.toISOString() };
}

export function restaurar(materia: Materia, ahora: Date): Materia {
  if (!materia.archivada) throw new TransicionInvalida('La materia no está archivada');
  return { ...materia, archivada: false, actualizadaEn: ahora.toISOString() };
}
