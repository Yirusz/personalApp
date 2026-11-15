/** Almacenes, eventos publicados y utilidades compartidas por los casos de uso del Calendario. */
import type { ContextoDeModulo, DeclaracionDeEvento, TransaccionDeLectura } from '../../../nucleo/contrato';
import { crearZona, type Zona } from '../../../nucleo/dominio/zona-horaria';
import { ZONA_HORARIA } from '../../../nucleo/i18n/traductor';
import { EventoNoEncontrado } from '../dominio/errores';
import type { EventoDeCalendario } from '../dominio/evento';

export const EVENTOS = 'eventos';
export const AGENDA = 'agenda';
export const AVISOS = 'avisos';
export const REVISIONES = 'revisiones';
export const INDICE_POR_UID = 'por_uid';

export const PUBLICADOS = {
  EventoCreado: 'calendario.EventoCreado',
  EventoEditado: 'calendario.EventoEditado',
  EventoEliminado: 'calendario.EventoEliminado',
  OcurrenciaModificada: 'calendario.OcurrenciaModificada',
  EventoMarcadoCumplido: 'calendario.EventoMarcadoCumplido',
  CalendarioImportado: 'calendario.CalendarioImportado',
  SemanaPlanificada: 'calendario.SemanaPlanificada',
} as const;

export const DECLARACIONES: Readonly<Record<string, DeclaracionDeEvento>> = {
  [PUBLICADOS.EventoCreado]: { version: 1, descripcion: 'Se creó un evento propio. Datos: eventoId, recurrente, compromiso.' },
  [PUBLICADOS.EventoEditado]: { version: 1, descripcion: 'Se editó un evento o toda su serie. Datos: eventoId.' },
  [PUBLICADOS.EventoEliminado]: { version: 1, descripcion: 'Se eliminó un evento o toda su serie. Datos: eventoId.' },
  [PUBLICADOS.OcurrenciaModificada]: {
    version: 1,
    descripcion: 'Se editó, canceló o restauró una ocurrencia de una serie. Datos: eventoId, ocurrencia (fecha original), accion (editada | cancelada | restaurada).',
  },
  [PUBLICADOS.EventoMarcadoCumplido]: {
    version: 1,
    descripcion: 'Se cumplió una ocurrencia de un bloque de compromiso. Datos: eventoId, ocurrencia, ocurrenciaId (eventoId|fecha), minutos.',
  },
  [PUBLICADOS.CalendarioImportado]: { version: 1, descripcion: 'Se importó un archivo .ics. Datos: creados, actualizados.' },
  [PUBLICADOS.SemanaPlanificada]: { version: 1, descripcion: 'Se marcó la semana como planificada. Datos: semana (AAAA-Www).' },
};

export type ContextoDeCasoDeUso = Pick<ContextoDeModulo, 'almacen' | 'reloj' | 'nuevoId'>;

/** Zona del usuario. La app es de un solo usuario en Colombia (ADR-0006); se centraliza aquí para cambiarla fácil. */
export const zonaDelUsuario = (): Zona => crearZona(ZONA_HORARIA);

export async function obtenerEvento(tx: TransaccionDeLectura, id: string): Promise<EventoDeCalendario> {
  const e = await tx.obtener<EventoDeCalendario>(EVENTOS, id);
  if (!e) throw new EventoNoEncontrado(`No existe el evento ${id}`);
  return e;
}

/** Registro de la proyección: un elemento que publicó otro módulo. */
export interface RegistroDeAgenda {
  clave: string;
  origen: string;
  agenda: unknown;
  actualizadoEn: string;
}

/** Estado de un aviso de recordatorio (para no repetir notificaciones y para descartar de la bandeja). */
export interface EstadoDeAviso {
  clave: string;
  momentoMs: number;
  notificadoEn?: string;
  descartadoEn?: string;
}

export interface RevisionSemanal {
  semana: string;
  hechaEn: string;
}
