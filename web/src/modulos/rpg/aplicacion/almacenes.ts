/** Almacenes, eventos y registros del RPG (ADR-0005, docs/gamificacion.md). */
import type { DeclaracionDeEvento, TransaccionDeLectura } from '../../../nucleo/contrato';
import { progresoPara } from '../dominio/nivel';
import { RACHA_INICIAL, type EstadoDeRacha, type ResultadoDeSemana } from '../dominio/racha';
import type { ConfiguracionDeReglas, NotaDeAsiento } from '../dominio/reglas';

export const ALMACEN_REGISTRO = 'registro';
export const ALMACEN_PERFIL = 'perfil';
/** Contadores por día local: cantidad y XP por tipo, contadores de logros y si el día cuenta para la racha. */
export const ALMACEN_DIAS = 'dias';
/** Semanas ya evaluadas (racha), una por lunes. */
export const ALMACEN_SEMANAS = 'semanas';
/** Totales de los contadores de logros (`total|<id>`) y entidades ya contadas (`<id>|<valor>`). */
export const ALMACEN_CONTADORES = 'contadores';
export const ALMACEN_LOGROS = 'logros';
export const ALMACEN_RECOMPENSAS = 'recompensas';
/** Avisos de nivel/logro pendientes de mostrar (R5). */
export const ALMACEN_AVISOS = 'avisos';

export const INDICE_TIPO_DIA = 'por_tipo_dia';
export const INDICE_CLAVE_UNICA = 'por_clave_unica';
export const ID_PERFIL = 'perfil';

export const EVENTOS = {
  NivelAlcanzado: 'rpg.NivelAlcanzado',
  NivelDeAtributoAlcanzado: 'rpg.NivelDeAtributoAlcanzado',
  LogroDesbloqueado: 'rpg.LogroDesbloqueado',
  SemanaDeRachaCumplida: 'rpg.SemanaDeRachaCumplida',
  ComodinGanado: 'rpg.ComodinGanado',
  ComodinUsado: 'rpg.ComodinUsado',
  RachaPerdida: 'rpg.RachaPerdida',
  SemanasCerradas: 'rpg.SemanasCerradas',
  RecompensaCanjeada: 'rpg.RecompensaCanjeada',
  CanjeAnulado: 'rpg.CanjeAnulado',
} as const;

/** @deprecated nombre anterior; usar EVENTOS.NivelAlcanzado. */
export const EVENTO_NIVEL_ALCANZADO = EVENTOS.NivelAlcanzado;

export const DECLARACIONES: Readonly<Record<string, DeclaracionDeEvento>> = {
  [EVENTOS.NivelAlcanzado]: { version: 1, descripcion: 'El personaje subió de nivel. Datos: nivel, nivelAnterior.' },
  [EVENTOS.NivelDeAtributoAlcanzado]: { version: 1, descripcion: 'Un atributo subió de nivel (R6). Datos: atributo, nivel.' },
  [EVENTOS.LogroDesbloqueado]: { version: 1, descripcion: 'Se desbloqueó un logro de la configuración. Datos: logroId, xp.' },
  [EVENTOS.SemanaDeRachaCumplida]: { version: 1, descripcion: 'Una semana cerrada cumplió la racha. ocurridoEn = fin de esa semana. Datos: semana (AAAA-Www), racha.' },
  [EVENTOS.ComodinGanado]: { version: 1, descripcion: 'Se ganó un comodín. Datos: semana, comodines.' },
  [EVENTOS.ComodinUsado]: { version: 1, descripcion: 'Un comodín salvó una semana no cumplida. Datos: semana, comodines.' },
  [EVENTOS.RachaPerdida]: { version: 1, descripcion: 'La racha volvió a 0 (la XP no baja). Datos: semana, semanasAntes.' },
  [EVENTOS.SemanasCerradas]: {
    version: 1,
    descripcion: 'Al abrir la app hay semanas cerradas sin evaluar: pide al RPG ponerse al día en orden (sin temporizadores). Datos: hasta (lunes).',
  },
  [EVENTOS.RecompensaCanjeada]: { version: 1, descripcion: 'Se canjeó una recompensa propia (asiento de oro gastado). Datos: recompensaId, nombre, costo.' },
  [EVENTOS.CanjeAnulado]: { version: 1, descripcion: 'Se deshizo un canje (devuelve el oro). Datos: canjeId, costo.' },
};

/** Un movimiento del libro: experiencia ganada u oro gastado/devuelto. */
export interface AsientoDeExperiencia {
  /** = id del evento que lo originó. */
  id: string;
  tipo: string;
  /** Día local (America/Bogota), AAAA-MM-DD. */
  dia: string;
  ocurridoEn: string;
  xpBase: number;
  xp: number;
  atributo: string;
  nota?: NotaDeAsiento;
  claveUnica?: string;
  /** Oro gastado (positivo) o devuelto (negativo) por canjes. */
  oro?: number;
  /** Canje deshecho. */
  anulado?: boolean;
}

export interface RachaGuardada extends EstadoDeRacha {
  /** Lunes de la primera semana que se evalúa (la del primer evento). */
  primerLunes: string | null;
  ultimoLunesEvaluado: string | null;
}

export interface Perfil {
  id: typeof ID_PERFIL;
  xpTotal: number;
  oroGastado: number;
  atributos: Record<string, number>;
  nivel: number;
  /** R6. */
  nivelesDeAtributo: Record<string, number>;
  racha: RachaGuardada;
  /** Versión de los contadores construidos desde el libro (iteración 6). */
  contadores?: number;
  actualizadoEn: string;
}

export interface DiaDeActividad {
  dia: string;
  porTipo: Record<string, { cantidad: number; xp: number }>;
  porContador: Record<string, number>;
  /** Hubo actividad que cuenta para la racha (registrada antes de que cerrara su semana). */
  activo: boolean;
}

export interface SemanaEvaluada {
  lunes: string;
  semana: string;
  diasActivos: number;
  resultado: ResultadoDeSemana;
  rachaAntes: number;
  despues: EstadoDeRacha;
  comodinGanado: boolean;
}

export interface LogroGuardado {
  id: string;
  desbloqueadoEn: string;
}

export interface Recompensa {
  id: string;
  nombre: string;
  costo: number;
  archivada: boolean;
  creadaEn: string;
  actualizadaEn: string;
}

export type AvisoPendiente =
  | { id: string; tipo: 'nivel'; nivel: number; creadoEn: string; mostradoEn?: string }
  | { id: string; tipo: 'logro'; logroId: string; creadoEn: string; mostradoEn?: string }
  | { id: string; tipo: 'atributo'; atributo: string; nivel: number; creadoEn: string; mostradoEn?: string };

export function perfilInicial(cfg: ConfiguracionDeReglas, instante: string): Perfil {
  return {
    id: ID_PERFIL,
    xpTotal: 0,
    oroGastado: 0,
    atributos: Object.fromEntries(cfg.atributos.map((a) => [a, 0])),
    nivel: 1,
    nivelesDeAtributo: Object.fromEntries(cfg.atributos.map((a) => [a, 1])),
    racha: { ...RACHA_INICIAL, primerLunes: null, ultimoLunesEvaluado: null },
    actualizadoEn: instante,
  };
}

/** Perfil guardado por una versión anterior: se completan los campos nuevos sin perder nada. */
export function perfilDesdeAlmacen(p: Partial<Perfil> | undefined, cfg: ConfiguracionDeReglas, instante: string): Perfil {
  const base = perfilInicial(cfg, instante);
  if (!p) return base;
  const atributos = { ...base.atributos, ...p.atributos };
  return {
    ...base,
    ...p,
    id: ID_PERFIL,
    atributos,
    nivelesDeAtributo: p.nivelesDeAtributo ?? Object.fromEntries(Object.entries(atributos).map(([a, xp]) => [a, progresoPara(xp, cfg.nivelDeAtributo).nivel])),
    racha: { ...base.racha, ...p.racha },
  } as Perfil;
}

export function oroDisponible(perfil: Pick<Perfil, 'xpTotal' | 'oroGastado'>, cfg: ConfiguracionDeReglas): number {
  return Math.floor(perfil.xpTotal / cfg.oro.xpPorOro) - perfil.oroGastado;
}

export function leerPerfilGuardado(tx: TransaccionDeLectura): Promise<Perfil | undefined> {
  return tx.obtener<Perfil>(ALMACEN_PERFIL, ID_PERFIL);
}

export const diaVacio = (dia: string): DiaDeActividad => ({ dia, porTipo: {}, porContador: {}, activo: false });
