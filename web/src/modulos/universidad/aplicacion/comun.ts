/** Almacenes, eventos publicados y utilidades de los casos de uso de Universidad. */
import type { ContextoDeModulo, DeclaracionDeEvento, TransaccionDeLectura } from '../../../nucleo/contrato';
import { crearZona, type Zona } from '../../../nucleo/dominio/zona-horaria';
import { ZONA_HORARIA } from '../../../nucleo/i18n/traductor';
import { MateriaNoEncontrada, TrabajoNoEncontrado } from '../dominio/errores';
import { materiaDesdeAlmacen, type Materia } from '../dominio/materia';
import { trabajoDesdeAlmacen, type Trabajo } from '../dominio/trabajo';

export const MATERIAS = 'materias';
/** El almacén conserva su nombre de la iteración 1 ("entregables"); guarda Trabajos (migración v2). */
export const TRABAJOS = 'entregables';
export const INDICE_POR_VENCIMIENTO = 'por_vencimiento';
export const INDICE_POR_MATERIA = 'por_materia';
export const INDICE_POR_ESTADO = 'por_estado';

export const EVENTOS = {
  MateriaCreada: 'universidad.MateriaCreada',
  MateriaEditada: 'universidad.MateriaEditada',
  MateriaArchivada: 'universidad.MateriaArchivada',
  MateriaRestaurada: 'universidad.MateriaRestaurada',
  TrabajoCreado: 'universidad.TrabajoCreado',
  TrabajoEditado: 'universidad.TrabajoEditado',
  TrabajoReprogramado: 'universidad.TrabajoReprogramado',
  TrabajoIniciado: 'universidad.TrabajoIniciado',
  TrabajoEntregado: 'universidad.TrabajoEntregado',
  TrabajoCalificado: 'universidad.TrabajoCalificado',
  TrabajoCancelado: 'universidad.TrabajoCancelado',
  TrabajoReabierto: 'universidad.TrabajoReabierto',
  TrabajoEliminado: 'universidad.TrabajoEliminado',
} as const;

const d = (descripcion: string): DeclaracionDeEvento => ({ version: 1, descripcion });

/**
 * Eventos v1. Los de la iteración 1 (`Entregable*`, `MateriaRenombrada`) ya no se
 * publican; quedan en el historial y el RPG conserva sus reglas.
 * Las subtareas no publican eventos (no dan puntos: evita partir trabajos).
 */
export const DECLARACIONES: Readonly<Record<string, DeclaracionDeEvento>> = {
  [EVENTOS.MateriaCreada]: d('Se creó una materia. Datos: materiaId, nombre, color, periodo.'),
  [EVENTOS.MateriaEditada]: d('Se editó una materia. Datos: materiaId, campos[].'),
  [EVENTOS.MateriaArchivada]: d('Se archivó una materia. Datos: materiaId.'),
  [EVENTOS.MateriaRestaurada]: d('Una materia archivada volvió a estar activa. Datos: materiaId.'),
  [EVENTOS.TrabajoCreado]: d('Se registró un trabajo. Datos: trabajoId, materiaId, tipo, peso (décimas de % o null), venceEn, antelacionHoras.'),
  [EVENTOS.TrabajoEditado]: d('Se editó un trabajo. Datos: trabajoId, campos[].'),
  [EVENTOS.TrabajoReprogramado]: d('Cambió la fecha límite. Datos: trabajoId, venceEnAnterior, venceEn.'),
  [EVENTOS.TrabajoIniciado]: d('Pasó a "en progreso". Datos: trabajoId.'),
  [EVENTOS.TrabajoEntregado]: d('Se entregó. Datos: trabajoId, materiaId, tipo, peso, aTiempo, minutosDesdeCreacion.'),
  [EVENTOS.TrabajoCalificado]: d('Se registró o corrigió la nota. Datos: trabajoId, materiaId, nota (décimas 0–50), aprobado, correccion.'),
  [EVENTOS.TrabajoCancelado]: d('Se canceló. Datos: trabajoId.'),
  [EVENTOS.TrabajoReabierto]: d('Se reabrió deliberadamente (vuelve a "en progreso"). Datos: trabajoId, desde.'),
  [EVENTOS.TrabajoEliminado]: d('Se eliminó. Datos: trabajoId.'),
};

export type ContextoDeCasoDeUso = Pick<ContextoDeModulo, 'almacen' | 'reloj' | 'nuevoId'>;

export const zonaDelUsuario = (): Zona => crearZona(ZONA_HORARIA);

export async function obtenerMateria(tx: TransaccionDeLectura, id: string): Promise<Materia> {
  const m = await tx.obtener(MATERIAS, id);
  if (!m) throw new MateriaNoEncontrada(`No existe la materia ${id}`);
  return materiaDesdeAlmacen(m);
}

export async function obtenerTrabajo(tx: TransaccionDeLectura, id: string): Promise<Trabajo> {
  const t = await tx.obtener(TRABAJOS, id);
  if (!t) throw new TrabajoNoEncontrado(`No existe el trabajo ${id}`);
  return trabajoDesdeAlmacen(t);
}

export async function listarMaterias(tx: TransaccionDeLectura): Promise<Materia[]> {
  return (await tx.listar(MATERIAS)).map(materiaDesdeAlmacen);
}
