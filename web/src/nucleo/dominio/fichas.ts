/**
 * Lenguaje publicado de fichas y vínculos (ADR-0015, amplía ADR-0013).
 *
 * Una *ficha* es una plantilla de evento que un módulo ofrece para ponerla rápido en el
 * calendario (p. ej. una por materia: "Cálculo II", clase semanal de 2 h). Un *vínculo*
 * apunta a una entidad de otro módulo por `{tipo, id}` (los tipos de `ReferenciaDeEntidad`).
 */
import { colorDeAgenda, type ColorDeAgenda } from './color';

export const FICHA_DURACION_MIN = 15;
export const FICHA_DURACION_MAX = 480;
export const FICHA_SEMANAS_MAX = 52;
/** Un semestre típico. */
export const FICHA_SEMANAS_POR_DEFECTO = 16;
export const FICHA_TITULO_MAX = 120;

export interface Vinculo {
  /** Tipo de referencia, p. ej. `universidad.materia`. */
  tipo: string;
  id: string;
}

export type RepeticionDeFicha = { tipo: 'unica' } | { tipo: 'semanal'; semanas: number };

export interface FichaDeCalendario {
  /** Id estable dentro del módulo que la ofrece. */
  id: string;
  titulo: string;
  /** Texto corto de apoyo (p. ej. "2026-2 · Dra. Pérez"). */
  detalle?: string;
  color: ColorDeAgenda;
  duracionMin: number;
  repeticion: RepeticionDeFicha;
  vinculo?: Vinculo;
}

const PATRON_TIPO = /^[a-z][a-z0-9]*\.[a-zA-Z][a-zA-Z0-9]*$/;

export class DatosDeFichaInvalidos extends Error {
  override readonly name = 'DatosDeFichaInvalidos';
}

export function vinculo(valor: unknown): Vinculo {
  const v = valor as Partial<Vinculo> | null;
  if (!v || typeof v.tipo !== 'string' || !PATRON_TIPO.test(v.tipo) || typeof v.id !== 'string' || !v.id || v.id.length > 100) {
    throw new DatosDeFichaInvalidos('Vínculo inválido');
  }
  return { tipo: v.tipo, id: v.id };
}

export function duracionDeFicha(minutos: unknown): number {
  if (!Number.isInteger(minutos) || (minutos as number) < FICHA_DURACION_MIN || (minutos as number) > FICHA_DURACION_MAX) {
    throw new DatosDeFichaInvalidos('Duración fuera de 15 min – 8 h');
  }
  return minutos as number;
}

export function repeticionDeFicha(valor: unknown): RepeticionDeFicha {
  const r = valor as Partial<{ tipo: string; semanas: number }> | null;
  if (r?.tipo === 'unica') return { tipo: 'unica' };
  if (r?.tipo === 'semanal' && Number.isInteger(r.semanas) && r.semanas! >= 1 && r.semanas! <= FICHA_SEMANAS_MAX) return { tipo: 'semanal', semanas: r.semanas! };
  throw new DatosDeFichaInvalidos('Repetición inválida');
}

/** Valida lo que entrega otro módulo (datos ajenos: nunca se confía en ellos). */
export function normalizarFicha(valor: unknown): FichaDeCalendario {
  const f = valor as Partial<FichaDeCalendario> | null;
  if (!f || typeof f.id !== 'string' || !f.id) throw new DatosDeFichaInvalidos('Ficha sin id');
  const titulo = typeof f.titulo === 'string' ? f.titulo.trim().replace(/\s+/g, ' ') : '';
  if (!titulo || titulo.length > FICHA_TITULO_MAX) throw new DatosDeFichaInvalidos('Título de ficha inválido');
  let color: ColorDeAgenda;
  try {
    color = colorDeAgenda(String(f.color));
  } catch {
    throw new DatosDeFichaInvalidos('Color de ficha inválido');
  }
  return {
    id: f.id,
    titulo,
    ...(typeof f.detalle === 'string' && f.detalle.trim() ? { detalle: f.detalle.trim().slice(0, 120) } : {}),
    color,
    duracionMin: duracionDeFicha(f.duracionMin),
    repeticion: repeticionDeFicha(f.repeticion),
    ...(f.vinculo ? { vinculo: vinculo(f.vinculo) } : {}),
  };
}
