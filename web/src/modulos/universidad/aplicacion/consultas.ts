/** Lecturas para las pantallas (sin efectos). */
import type { TransaccionDeLectura } from '../../../nucleo/contrato';
import type { Entregable } from '../dominio/entregable';
import type { Materia } from '../dominio/materia';
import { ENTREGABLES, INDICE_POR_VENCIMIENTO, MATERIAS } from './comun';

const porNombre = (a: Materia, b: Materia) => a.nombre.localeCompare(b.nombre, 'es-CO');

export async function leerMaterias(tx: TransaccionDeLectura): Promise<Materia[]> {
  return (await tx.listar<Materia>(MATERIAS)).sort(porNombre);
}

/** Todos los entregables por fecha de vencimiento. Un semestre tiene decenas; si crece mucho, paginar por índice. */
export function leerEntregables(tx: TransaccionDeLectura): Promise<Entregable[]> {
  return tx.listar<Entregable>(ENTREGABLES, { indice: INDICE_POR_VENCIMIENTO });
}

export interface Panel {
  materias: Materia[];
  entregables: Entregable[];
}

export async function leerPanel(tx: TransaccionDeLectura): Promise<Panel> {
  const [materias, entregables] = await Promise.all([leerMaterias(tx), leerEntregables(tx)]);
  return { materias, entregables };
}

export async function leerEntregableConMateria(
  tx: TransaccionDeLectura,
  id: string,
): Promise<{ entregable: Entregable; materia: Materia | undefined } | null> {
  const entregable = await tx.obtener<Entregable>(ENTREGABLES, id);
  if (!entregable) return null;
  return { entregable, materia: await tx.obtener<Materia>(MATERIAS, entregable.materiaId) };
}
