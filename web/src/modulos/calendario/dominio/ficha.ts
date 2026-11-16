/**
 * Fichas (H8, ADR-0015): plantillas para poner y quitar cosas del calendario con un toque.
 * Las aportan los módulos (p. ej. una por materia) o las crea el usuario (fichas propias).
 */
import { colorDeAgenda, type ColorDeAgenda } from '../../../nucleo/dominio/color';
import {
  FICHA_DURACION_MAX,
  FICHA_DURACION_MIN,
  FICHA_SEMANAS_MAX,
  type FichaDeCalendario,
  type RepeticionDeFicha,
} from '../../../nucleo/dominio/fichas';
import { MS_MINUTO, type Zona } from '../../../nucleo/dominio/zona-horaria';
import { titulo as tituloValido, type DatosDeEvento } from './evento';
import { ColorDeEventoInvalido, DuracionDeFichaInvalida, SemanasDeFichaInvalidas } from './errores';
import { diaSemana } from './fechas';

export interface DatosDeFichaPropia {
  titulo: string;
  color: string;
  duracionMin: number;
  repeticion: RepeticionDeFicha;
}

export interface FichaPropia {
  readonly id: string;
  titulo: string;
  color: ColorDeAgenda;
  duracionMin: number;
  repeticion: RepeticionDeFicha;
  readonly creadaEn: string;
  readonly actualizadaEn: string;
}

/** Identifica la ficha de un módulo en los eventos que crea. */
export const claveDeFicha = (modulo: string, id: string) => `${modulo}:${id}`;

/** Al tocar un hueco, la ficha empieza en la media hora (hacia abajo). */
export const horaDeHueco = (minutos: number) => Math.min(23 * 60 + 30, Math.floor(minutos / 30) * 30);

function validar(d: DatosDeFichaPropia) {
  let color: ColorDeAgenda;
  try {
    color = colorDeAgenda(d.color);
  } catch {
    throw new ColorDeEventoInvalido(`Color inválido: ${d.color}`);
  }
  if (!Number.isInteger(d.duracionMin) || d.duracionMin < FICHA_DURACION_MIN || d.duracionMin > FICHA_DURACION_MAX) {
    throw new DuracionDeFichaInvalida('Duración fuera de 15 min – 8 h');
  }
  const r = d.repeticion;
  if (r.tipo === 'semanal' && (!Number.isInteger(r.semanas) || r.semanas < 1 || r.semanas > FICHA_SEMANAS_MAX)) {
    throw new SemanasDeFichaInvalidas('Semanas fuera de 1–52');
  }
  return { titulo: tituloValido(d.titulo), color, duracionMin: d.duracionMin, repeticion: r.tipo === 'unica' ? ({ tipo: 'unica' } as const) : { tipo: 'semanal' as const, semanas: r.semanas } };
}

export function crearFichaPropia(d: DatosDeFichaPropia & { id: string }, ahora: Date): FichaPropia {
  const instante = ahora.toISOString();
  return { id: d.id, ...validar(d), creadaEn: instante, actualizadaEn: instante };
}

export function editarFichaPropia(f: FichaPropia, d: DatosDeFichaPropia, ahora: Date): FichaPropia {
  return { ...f, ...validar(d), actualizadaEn: ahora.toISOString() };
}

export function comoFicha(f: FichaPropia): FichaDeCalendario {
  return { id: f.id, titulo: f.titulo, color: f.color, duracionMin: f.duracionMin, repeticion: f.repeticion };
}

/**
 * Datos del evento que crea una ficha puesta en `inicioMs`: semanal → serie de N semanas
 * en ese día de la semana (local); única → un solo evento. Lleva el vínculo y la ficha.
 */
export function eventoDesdeFicha(f: FichaDeCalendario, clave: string, inicioMs: number, zona: Zona): DatosDeEvento {
  const fecha = zona.aCivil(inicioMs).fecha;
  return {
    titulo: f.titulo,
    lugar: '',
    notas: '',
    color: f.color,
    todoElDia: false,
    inicio: new Date(inicioMs).toISOString(),
    fin: new Date(inicioMs + f.duracionMin * MS_MINUTO).toISOString(),
    recordatorios: [],
    recurrencia: f.repeticion.tipo === 'semanal' ? { frecuencia: 'semanal', intervalo: 1, dias: [diaSemana(fecha)], fin: { tipo: 'conteo', veces: f.repeticion.semanas } } : null,
    compromiso: false,
    vinculo: f.vinculo ?? null,
    ficha: clave,
  };
}
