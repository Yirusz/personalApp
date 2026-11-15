/** Nombres de almacenes, eventos y utilidades compartidas por los casos de uso de Universidad. */
import type { ContextoDeModulo, DeclaracionDeEvento, TransaccionDeLectura } from '../../../nucleo/contrato';
import { EntregableNoEncontrado, MateriaNoEncontrada } from '../dominio/errores';
import type { Entregable } from '../dominio/entregable';
import type { Materia } from '../dominio/materia';

export const MATERIAS = 'materias';
export const ENTREGABLES = 'entregables';
export const INDICE_POR_VENCIMIENTO = 'por_vencimiento';
export const INDICE_POR_MATERIA = 'por_materia';
export const INDICE_POR_ESTADO = 'por_estado';

/** Catálogo de eventos publicados (contrato con los demás módulos; ver docs/dominio.md §2). */
export const EVENTOS = {
  MateriaCreada: 'universidad.MateriaCreada',
  MateriaRenombrada: 'universidad.MateriaRenombrada',
  MateriaArchivada: 'universidad.MateriaArchivada',
  MateriaRestaurada: 'universidad.MateriaRestaurada',
  EntregableCreado: 'universidad.EntregableCreado',
  EntregableEditado: 'universidad.EntregableEditado',
  EntregableReprogramado: 'universidad.EntregableReprogramado',
  EntregableIniciado: 'universidad.EntregableIniciado',
  EntregableCompletado: 'universidad.EntregableCompletado',
  EntregableReabierto: 'universidad.EntregableReabierto',
  EntregableEliminado: 'universidad.EntregableEliminado',
} as const;

const AGENDA = 'agenda (ElementoDeAgenda, para el Calendario)';

/** Versión y forma de los datos de cada evento. Cambiar la forma = subir la versión. */
export const DECLARACIONES: Readonly<Record<string, DeclaracionDeEvento>> = {
  [EVENTOS.MateriaCreada]: { version: 1, descripcion: 'Se creó una materia. Datos: materiaId, nombre, color.' },
  [EVENTOS.MateriaRenombrada]: { version: 1, descripcion: 'Cambió el nombre de una materia. Datos: materiaId, nombre.' },
  [EVENTOS.MateriaArchivada]: { version: 1, descripcion: 'Se archivó una materia. Datos: materiaId.' },
  [EVENTOS.MateriaRestaurada]: { version: 1, descripcion: 'Una materia archivada volvió a estar activa. Datos: materiaId.' },
  [EVENTOS.EntregableCreado]: {
    version: 1,
    descripcion: `Se registró un entregable. Datos: entregableId, materiaId, talla, venceEn, antelacionHoras, ${AGENDA}.`,
  },
  [EVENTOS.EntregableEditado]: {
    version: 1,
    descripcion: `Cambió el título, tipo, prioridad o talla. Datos: entregableId, campos[], talla, ${AGENDA}.`,
  },
  [EVENTOS.EntregableReprogramado]: {
    version: 1,
    descripcion: `Cambió la fecha de entrega. Datos: entregableId, venceEnAnterior, venceEn, ${AGENDA}.`,
  },
  [EVENTOS.EntregableIniciado]: { version: 1, descripcion: 'Un entregable pasó a "en curso". Datos: entregableId.' },
  [EVENTOS.EntregableCompletado]: {
    version: 1,
    descripcion: `Se completó un entregable. Datos: entregableId, materiaId, talla, aTiempo, minutosDesdeCreacion, ${AGENDA}.`,
  },
  [EVENTOS.EntregableReabierto]: { version: 1, descripcion: `Un entregable completado volvió a "en curso". Datos: entregableId, ${AGENDA}.` },
  [EVENTOS.EntregableEliminado]: { version: 1, descripcion: `Se eliminó un entregable. Datos: entregableId, ${AGENDA} con estado "eliminado".` },
};

/** Lo que un caso de uso necesita del contexto del módulo (fácil de construir en pruebas). */
export type ContextoDeCasoDeUso = Pick<ContextoDeModulo, 'almacen' | 'reloj' | 'nuevoId'>;

export async function obtenerMateria(tx: TransaccionDeLectura, id: string): Promise<Materia> {
  const materia = await tx.obtener<Materia>(MATERIAS, id);
  if (!materia) throw new MateriaNoEncontrada(`No existe la materia ${id}`);
  return materia;
}

export async function obtenerEntregable(tx: TransaccionDeLectura, id: string): Promise<Entregable> {
  const entregable = await tx.obtener<Entregable>(ENTREGABLES, id);
  if (!entregable) throw new EntregableNoEncontrado(`No existe el entregable ${id}`);
  return entregable;
}
