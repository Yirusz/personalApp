/** Lecturas para las pantallas (sin efectos). Siempre pasan por los lectores de datos guardados (versiones anteriores). */
import type { TransaccionDeLectura } from '../../../nucleo/contrato';
import type { Materia } from '../dominio/materia';
import { trabajoDesdeAlmacen, type Trabajo } from '../dominio/trabajo';
import { INDICE_POR_VENCIMIENTO, listarMaterias, MATERIAS, TRABAJOS } from './comun';

const porPeriodoYNombre = (a: Materia, b: Materia) => b.periodo.localeCompare(a.periodo, 'es-CO') || a.nombre.localeCompare(b.nombre, 'es-CO');

export async function leerMaterias(tx: TransaccionDeLectura): Promise<Materia[]> {
  return (await listarMaterias(tx)).sort(porPeriodoYNombre);
}

export async function leerTrabajos(tx: TransaccionDeLectura): Promise<Trabajo[]> {
  return (await tx.listar(TRABAJOS, { indice: INDICE_POR_VENCIMIENTO })).map(trabajoDesdeAlmacen);
}

export interface Panel {
  materias: Materia[];
  trabajos: Trabajo[];
}

export async function leerPanel(tx: TransaccionDeLectura): Promise<Panel> {
  const [materias, trabajos] = await Promise.all([leerMaterias(tx), leerTrabajos(tx)]);
  return { materias, trabajos };
}

export async function leerTrabajoConMateria(tx: TransaccionDeLectura, id: string): Promise<{ trabajo: Trabajo; materia: Materia | undefined } | null> {
  const t = await tx.obtener(TRABAJOS, id);
  if (!t) return null;
  const trabajo = trabajoDesdeAlmacen(t);
  const materia = (await listarMaterias(tx)).find((m) => m.id === trabajo.materiaId);
  return { trabajo, materia };
}

export const ALMACENES_DEL_PANEL = [MATERIAS, TRABAJOS];
