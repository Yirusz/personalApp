/** Lecturas de la pantalla de Progreso (una sola transacción). */
import type { TransaccionDeLectura } from '../../../nucleo/contrato';
import { diasDeLaSemana, lunesDe } from '../dominio/racha';
import {
  ALMACEN_DIAS,
  ALMACEN_LOGROS,
  ALMACEN_PERFIL,
  ALMACEN_RECOMPENSAS,
  ALMACEN_REGISTRO,
  ALMACEN_SEMANAS,
  type AsientoDeExperiencia,
  type DiaDeActividad,
  type LogroGuardado,
  type Perfil,
  type Recompensa,
  type SemanaEvaluada,
} from '../aplicacion/almacenes';

export const ALMACENES_DE_PROGRESO = [ALMACEN_PERFIL, ALMACEN_REGISTRO, ALMACEN_SEMANAS, ALMACEN_DIAS, ALMACEN_LOGROS, ALMACEN_RECOMPENSAS];

export interface PantallaDeProgreso {
  perfil: Perfil | undefined;
  asientos: AsientoDeExperiencia[];
  semanas: SemanaEvaluada[];
  /** Días activos de la semana en curso. */
  activosEstaSemana: number;
  logros: LogroGuardado[];
  recompensas: Recompensa[];
}

export async function leerPantalla(tx: TransaccionDeLectura, hoy: string): Promise<PantallaDeProgreso> {
  const dias = await Promise.all(diasDeLaSemana(lunesDe(hoy)).map((f) => tx.obtener<DiaDeActividad>(ALMACEN_DIAS, f)));
  return {
    perfil: await tx.obtener<Perfil>(ALMACEN_PERFIL, 'perfil'),
    asientos: await tx.listar<AsientoDeExperiencia>(ALMACEN_REGISTRO, { inverso: true, limite: 30 }),
    semanas: await tx.listar<SemanaEvaluada>(ALMACEN_SEMANAS, { inverso: true, limite: 8 }),
    activosEstaSemana: dias.filter((d) => d?.activo).length,
    logros: await tx.listar<LogroGuardado>(ALMACEN_LOGROS),
    recompensas: (await tx.listar<Recompensa>(ALMACEN_RECOMPENSAS)).sort((a, b) => a.costo - b.costo || a.nombre.localeCompare(b.nombre, 'es')),
  };
}

/** "estudio.PomodoroCompletado" → etiqueta declarada por su módulo, o el tipo técnico. */
export function etiquetaDeEvento(t: ((c: string) => string) & { existe?: (c: string) => boolean }, tipo: string): string {
  const [modulo, nombre] = tipo.split('.');
  const clave = `${modulo}.evento.${nombre}`;
  return t.existe?.(clave) ? t(clave) : tipo;
}
