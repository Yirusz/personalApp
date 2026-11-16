/**
 * Agregado SesionActiva (E1, E5). Una sola sesión activa a la vez (la garantiza el caso de
 * uso, dentro de una transacción). El tiempo NUNCA se cuenta con ticks: se guarda cuándo
 * empezó, cuánto dura y las pausas, y con el Reloj se calcula el fin y lo que falta.
 * Así es correcta aunque Android congele la app, se recargue o haya dos pestañas.
 */
import { vinculo as vinculoValido, type Vinculo } from '../../../nucleo/dominio/fichas';
import type { Zona } from '../../../nucleo/dominio/zona-horaria';
import type { ConfiguracionPomodoro } from './configuracion';
import { ErrorDeEstudio, estadoInvalido } from './errores';

export const FASES = ['foco', 'corto', 'largo'] as const;
export type Fase = (typeof FASES)[number];
export const DURACION_MIN = 1;
export const DURACION_MAX = 90;
const MS_MIN = 60_000;

export interface Pausa {
  desde: string;
  hasta: string | null;
}

export interface SesionActiva {
  readonly id: string;
  fase: Fase;
  /** Materia o trabajo (ADR-0013): solo {tipo, id}; el nombre se resuelve al mostrar. */
  vinculo: Vinculo | null;
  duracionMin: number;
  iniciadaEn: string;
  pausas: readonly Pausa[];
}

export type EstadoFinal = 'completada' | 'interrumpida' | 'saltada';

export interface SesionTerminada {
  readonly id: string;
  fase: Fase;
  vinculo: Vinculo | null;
  duracionMin: number;
  iniciadaEn: string;
  /** Cuándo terminó de verdad (completada: inicio + duración + pausas, aunque se detecte después). */
  finalizadaEn: string;
  estado: EstadoFinal;
  /** Minutos efectivos (sin pausas). */
  minutosEfectivos: number;
  /** Día civil (zona del usuario) de `finalizadaEn`: al que cuentan las estadísticas. */
  dia: string;
}

export function iniciar(d: { id: string; fase: Fase; duracionMin: number; vinculo: Vinculo | null; ahora: Date }): SesionActiva {
  if (!FASES.includes(d.fase)) throw estadoInvalido(`Fase desconocida: ${String(d.fase)}`);
  if (!Number.isInteger(d.duracionMin) || d.duracionMin < DURACION_MIN || d.duracionMin > DURACION_MAX) {
    throw new ErrorDeEstudio('estudio.error.duracion', 'Duración fuera de rango', 'duracion', { min: DURACION_MIN, max: DURACION_MAX });
  }
  let vinculo: Vinculo | null = null;
  if (d.vinculo) {
    try {
      vinculo = vinculoValido(d.vinculo);
    } catch {
      throw new ErrorDeEstudio('estudio.error.vinculo', 'Vínculo mal formado', 'vinculo');
    }
  }
  return { id: d.id, fase: d.fase, vinculo: d.fase === 'foco' ? vinculo : null, duracionMin: d.duracionMin, iniciadaEn: d.ahora.toISOString(), pausas: [] };
}

export const estaPausada = (s: SesionActiva) => s.pausas.length > 0 && s.pausas[s.pausas.length - 1]!.hasta === null;

/** Milisegundos en pausa hasta `ahoraMs` (una pausa abierta cuenta hasta ahora). */
function msEnPausa(s: SesionActiva, ahoraMs: number): number {
  return s.pausas.reduce((suma, p) => suma + ((p.hasta === null ? ahoraMs : Date.parse(p.hasta)) - Date.parse(p.desde)), 0);
}

/** Fin previsto: inicio + duración + pausas. En pausa, se corre con el tiempo. */
export function finPrevistoMs(s: SesionActiva, ahoraMs: number): number {
  return Date.parse(s.iniciadaEn) + s.duracionMin * MS_MIN + msEnPausa(s, ahoraMs);
}

export function restanteMs(s: SesionActiva, ahoraMs: number): number {
  return Math.max(0, finPrevistoMs(s, ahoraMs) - ahoraMs);
}

export function estaVencida(s: SesionActiva, ahoraMs: number): boolean {
  return !estaPausada(s) && finPrevistoMs(s, ahoraMs) <= ahoraMs;
}

export function pausar(s: SesionActiva, ahora: Date): SesionActiva {
  if (estaPausada(s)) throw estadoInvalido('Ya está en pausa');
  if (estaVencida(s, ahora.getTime())) throw estadoInvalido('Ya terminó');
  return { ...s, pausas: [...s.pausas, { desde: ahora.toISOString(), hasta: null }] };
}

export function reanudar(s: SesionActiva, ahora: Date): SesionActiva {
  if (!estaPausada(s)) throw estadoInvalido('No está en pausa');
  return { ...s, pausas: [...s.pausas.slice(0, -1), { desde: s.pausas[s.pausas.length - 1]!.desde, hasta: ahora.toISOString() }] };
}

function terminar(s: SesionActiva, estado: EstadoFinal, finMs: number, zona: Zona): SesionTerminada {
  const efectivos = Math.floor((finMs - Date.parse(s.iniciadaEn) - msEnPausa(s, finMs)) / MS_MIN);
  return {
    id: s.id,
    fase: s.fase,
    vinculo: s.vinculo,
    duracionMin: s.duracionMin,
    iniciadaEn: s.iniciadaEn,
    finalizadaEn: new Date(finMs).toISOString(),
    estado,
    minutosEfectivos: Math.max(0, Math.min(s.duracionMin, efectivos)),
    dia: zona.aCivil(finMs).fecha,
  };
}

/** Termina una sesión vencida. El fin es el previsto (exacto), no cuándo se detectó. */
export function completar(s: SesionActiva, ahora: Date, zona: Zona): SesionTerminada {
  if (!estaVencida(s, ahora.getTime())) throw new ErrorDeEstudio('estudio.error.noTermino', 'La sesión aún no termina');
  return terminar(s, 'completada', finPrevistoMs(s, ahora.getTime()), zona);
}

/** Detener antes de tiempo (cualquier fase). */
export function interrumpir(s: SesionActiva, ahora: Date, zona: Zona): SesionTerminada {
  if (estaVencida(s, ahora.getTime())) throw estadoInvalido('Ya terminó: se completa');
  return terminar(s, 'interrumpida', ahora.getTime(), zona);
}

/** Saltar un descanso. */
export function saltar(s: SesionActiva, ahora: Date, zona: Zona): SesionTerminada {
  if (s.fase === 'foco') throw estadoInvalido('Solo se saltan los descansos');
  return terminar(s, 'saltada', Math.min(ahora.getTime(), finPrevistoMs(s, ahora.getTime())), zona);
}

export interface Ciclo {
  /** Focos completados desde el último descanso largo. */
  focosEnCiclo: number;
}

export const CICLO_INICIAL: Ciclo = { focosEnCiclo: 0 };

/** Qué fase se propone después de terminar `fase` con `estado`. */
export function siguiente(cfg: ConfiguracionPomodoro, ciclo: Ciclo, fase: Fase, estado: EstadoFinal): { fase: Fase; duracionMin: number; ciclo: Ciclo } {
  const foco = { fase: 'foco' as const, duracionMin: cfg.focoMin };
  if (fase === 'foco') {
    if (estado !== 'completada') return { ...foco, ciclo };
    const n = ciclo.focosEnCiclo + 1;
    return n >= cfg.largoCada ? { fase: 'largo', duracionMin: cfg.largoMin, ciclo: { focosEnCiclo: n } } : { fase: 'corto', duracionMin: cfg.cortoMin, ciclo: { focosEnCiclo: n } };
  }
  return { ...foco, ciclo: fase === 'largo' ? CICLO_INICIAL : ciclo };
}
