/**
 * Recordatorios (ADR-0004): una PWA solo puede avisar con la app abierta.
 * - `avisosEntre`: los que vencen en un intervalo → notificación mientras la app está abierta.
 * - `avisosPendientes`: al abrir la app, los vencidos cuyo evento no ha terminado → bandeja en Inicio.
 */
import { MS_DIA, MS_MINUTO } from '../../../nucleo/dominio/zona-horaria';
import type { Ocurrencia, Rango } from './visible';

export interface Aviso {
  /** `<eventoId>|<fecha original>|<minutos>`: identifica el aviso para no repetirlo. */
  clave: string;
  eventoId: string;
  ocurrencia: string;
  titulo: string;
  minutos: number;
  momentoMs: number;
  inicioMs: number;
  finMs: number;
  todoElDia: boolean;
}

/** Hasta cuántos días atrás se muestra un aviso vencido en la bandeja. */
export const DIAS_DE_BANDEJA = 7;

function avisos(ocurrencias: readonly Ocurrencia[]): Aviso[] {
  return ocurrencias
    .flatMap((o) =>
      o.recordatorios.map((minutos) => ({
        clave: `${o.eventoId}|${o.clave}|${minutos}`,
        eventoId: o.eventoId,
        ocurrencia: o.clave,
        titulo: o.titulo,
        minutos,
        momentoMs: o.inicioMs - minutos * MS_MINUTO,
        inicioMs: o.inicioMs,
        finMs: o.finMs,
        todoElDia: o.todoElDia,
      })),
    )
    .sort((a, b) => a.momentoMs - b.momentoMs || a.clave.localeCompare(b.clave));
}

/** Avisos con momento en (desde, hasta]. */
export function avisosEntre(ocurrencias: readonly Ocurrencia[], desdeMs: number, hastaMs: number): Aviso[] {
  return avisos(ocurrencias).filter((a) => a.momentoMs > desdeMs && a.momentoMs <= hastaMs);
}

/** Avisos ya vencidos cuyo evento sigue vigente, sin descartar. */
export function avisosPendientes(ocurrencias: readonly Ocurrencia[], ahoraMs: number, descartados: ReadonlySet<string>): Aviso[] {
  return avisos(ocurrencias).filter(
    (a) => a.momentoMs <= ahoraMs && a.finMs > ahoraMs && a.momentoMs > ahoraMs - DIAS_DE_BANDEJA * MS_DIA && !descartados.has(a.clave),
  );
}

/** Rango de ocurrencias a expandir para calcular avisos alrededor de `ahora` (recordatorios de hasta 4 semanas). */
export function rangoParaAvisos(ahoraMs: number): Rango {
  return { desdeMs: ahoraMs - 15 * MS_DIA, hastaMs: ahoraMs + 29 * MS_DIA };
}
