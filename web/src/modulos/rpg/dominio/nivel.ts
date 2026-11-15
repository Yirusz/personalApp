/**
 * Fórmula de nivel (ADR-0005): XP acumulada para alcanzar el nivel n
 *   = ⌊base · (n − 1)^exponente⌋   (nivel 1 = 0 XP).
 * Con base 100 y exponente 1,5: N2 = 100, N3 = 282, N5 = 800, N10 = 2700, N20 = 8281.
 */
export interface ParametrosDeNivel {
  base: number;
  exponente: number;
}

export function xpParaNivel(nivel: number, p: ParametrosDeNivel): number {
  if (!Number.isInteger(nivel) || nivel < 1) throw new RangeError(`Nivel inválido: ${nivel}`);
  return Math.floor(p.base * (nivel - 1) ** p.exponente);
}

export interface Progreso {
  nivel: number;
  /** XP ganada dentro del nivel actual. */
  xpEnNivel: number;
  /** XP que separa el nivel actual del siguiente. */
  xpDelTramo: number;
  /** 0 … 1 */
  fraccion: number;
}

const NIVEL_MAXIMO = 999;

export function progresoPara(xpTotal: number, p: ParametrosDeNivel): Progreso {
  if (!Number.isFinite(xpTotal) || xpTotal < 0) throw new RangeError(`XP inválida: ${xpTotal}`);
  let nivel = 1;
  while (nivel < NIVEL_MAXIMO && xpParaNivel(nivel + 1, p) <= xpTotal) nivel++;
  const inicio = xpParaNivel(nivel, p);
  const fin = xpParaNivel(Math.min(nivel + 1, NIVEL_MAXIMO), p);
  const xpDelTramo = Math.max(1, fin - inicio);
  const xpEnNivel = xpTotal - inicio;
  return { nivel, xpEnNivel, xpDelTramo, fraccion: Math.min(1, xpEnNivel / xpDelTramo) };
}
