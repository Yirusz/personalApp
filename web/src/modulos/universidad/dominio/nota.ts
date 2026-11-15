/**
 * Value objects numéricos guardados como ENTEROS (nunca se opera con flotantes):
 * - Nota colombiana 0,0–5,0 en décimas (37 = 3,7).
 * - Peso porcentual 0,1–100 % en décimas de punto (125 = 12,5 %).
 */
import { NotaInvalida, PesoInvalido } from './errores';

export const NOTA_MAX = 50;
export const NOTA_APROBATORIA = 30;
export const PESO_MAX = 1000;

/** Valida una nota en décimas. */
export function nota(decimas: number): number {
  if (!Number.isInteger(decimas) || decimas < 0 || decimas > NOTA_MAX) throw new NotaInvalida(`Nota fuera de 0,0–5,0: ${decimas}`);
  return decimas;
}

/** "3,7", "3.7", "4" → décimas. Un decimal como máximo (escala de la universidad). */
export function notaDesdeTexto(texto: string): number {
  const m = /^(\d)(?:[.,](\d))?$/.exec(texto.trim());
  if (!m) throw new NotaInvalida(`Nota inválida: ${texto}`);
  return nota(Number(m[1]) * 10 + Number(m[2] ?? 0));
}

export function textoDeNota(decimas: number): string {
  return `${Math.floor(decimas / 10)},${decimas % 10}`;
}

/** "" → null (sin peso); "20" → 200; "12,5" → 125. */
export function pesoDesdeTexto(texto: string): number | null {
  const limpio = texto.trim().replace('%', '').trim();
  if (limpio === '') return null;
  const m = /^(\d{1,3})(?:[.,](\d))?$/.exec(limpio);
  if (!m) throw new PesoInvalido(`Peso inválido: ${texto}`);
  return peso(Number(m[1]) * 10 + Number(m[2] ?? 0));
}

export function peso(decimas: number | null): number | null {
  if (decimas === null) return null;
  if (!Number.isInteger(decimas) || decimas < 1 || decimas > PESO_MAX) throw new PesoInvalido(`Peso fuera de 0,1–100 %: ${decimas}`);
  return decimas;
}

export function textoDePeso(decimas: number): string {
  return decimas % 10 === 0 ? `${decimas / 10} %` : `${Math.floor(decimas / 10)},${decimas % 10} %`;
}
