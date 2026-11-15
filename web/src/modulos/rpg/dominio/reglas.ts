/**
 * Configuración de reglas del RPG (ADR-0005). Se valida al arrancar: una
 * configuración inválida detiene la app con un mensaje claro (falla rápido).
 *
 * Estado de implementación (fundación): el motor aplica `xp`, `xpPorTalla` y
 * `limiteDiarioXp`. Los demás campos ya se validan y se implementan en la
 * iteración del RPG (ver docs/plan-maestro.md).
 */
import { PATRON_TIPO_EVENTO } from '../../../nucleo/dominio/evento';

export type Talla = 'S' | 'M' | 'L';

export interface TramoDiario {
  /** Cantidad acumulada de eventos del día hasta la que aplica el factor; `null` = sin tope. */
  hasta: number | null;
  factor: number;
}

export interface ReglaDeEvento {
  evento: string;
  atributo: string;
  xp?: number;
  xpPorTalla?: Partial<Record<Talla, number>>;
  limiteDiarioXp?: number;
  // ---- Pendientes de implementar (iteración RPG) ----
  multiplicadorPuntual?: number;
  minMinutosDesdeCreacion?: number;
  minAntelacionHoras?: number;
  tramosDiarios?: TramoDiario[];
  unaVezPor?: string;
  sinMultiplicadorDeRacha?: boolean;
}

export interface ConfiguracionDeRacha {
  diasActivosPorSemana: number;
  bonoPorSemana: number;
  bonoMaximo: number;
  semanasPorComodin: number;
  comodinesMaximos: number;
  eventosQueCuentan: string[];
}

export interface ConfiguracionDeReglas {
  version: number;
  nivel: { base: number; exponente: number };
  oro: { xpPorOro: number };
  atributos: string[];
  racha: ConfiguracionDeRacha;
  reglas: ReglaDeEvento[];
}

export class ConfiguracionInvalida extends Error {
  override name = 'ConfiguracionInvalida';
}

const esNumero = (v: unknown, min = 0): v is number => typeof v === 'number' && Number.isFinite(v) && v >= min;
const esObjeto = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

export function validarConfiguracion(datos: unknown): ConfiguracionDeReglas {
  const p: string[] = [];
  if (!esObjeto(datos)) throw new ConfiguracionInvalida('La configuración del RPG no es un objeto');
  if (datos.version !== 1) p.push('version debe ser 1');
  const nivel = datos.nivel;
  if (!esObjeto(nivel) || !esNumero(nivel.base, 1) || !esNumero(nivel.exponente, 1)) p.push('nivel.base y nivel.exponente deben ser ≥ 1');
  if (!esObjeto(datos.oro) || !esNumero(datos.oro.xpPorOro, 1)) p.push('oro.xpPorOro debe ser ≥ 1');
  const atributos = Array.isArray(datos.atributos) ? datos.atributos.filter((a): a is string => typeof a === 'string') : [];
  if (atributos.length === 0) p.push('atributos debe ser una lista de textos');
  const racha = datos.racha;
  if (
    !esObjeto(racha) ||
    !esNumero(racha.diasActivosPorSemana, 1) ||
    (racha.diasActivosPorSemana as number) > 7 ||
    !esNumero(racha.bonoPorSemana) ||
    !esNumero(racha.bonoMaximo) ||
    !esNumero(racha.semanasPorComodin, 1) ||
    !esNumero(racha.comodinesMaximos) ||
    !Array.isArray(racha.eventosQueCuentan)
  ) {
    p.push('racha incompleta o con valores fuera de rango');
  }

  const vistos = new Set<string>();
  const reglas = Array.isArray(datos.reglas) ? datos.reglas : [];
  if (!Array.isArray(datos.reglas)) p.push('reglas debe ser una lista');
  reglas.forEach((r: unknown, i) => {
    const donde = `reglas[${i}]`;
    if (!esObjeto(r)) return p.push(`${donde} no es un objeto`);
    if (typeof r.evento !== 'string' || !PATRON_TIPO_EVENTO.test(r.evento)) p.push(`${donde}.evento inválido`);
    else if (vistos.has(r.evento)) p.push(`${donde}: evento repetido ${r.evento}`);
    else vistos.add(r.evento);
    if (typeof r.atributo !== 'string' || !atributos.includes(r.atributo)) p.push(`${donde}.atributo desconocido: ${String(r.atributo)}`);
    const tieneXp = r.xp !== undefined;
    const tieneTalla = r.xpPorTalla !== undefined;
    if (tieneXp === tieneTalla) p.push(`${donde}: debe tener exactamente uno de xp o xpPorTalla`);
    if (tieneXp && !esNumero(r.xp)) p.push(`${donde}.xp debe ser ≥ 0`);
    if (tieneTalla && (!esObjeto(r.xpPorTalla) || !Object.values(r.xpPorTalla).every((v) => esNumero(v)))) {
      p.push(`${donde}.xpPorTalla inválido`);
    }
    for (const campo of ['limiteDiarioXp', 'minMinutosDesdeCreacion', 'minAntelacionHoras'] as const) {
      if (r[campo] !== undefined && !esNumero(r[campo])) p.push(`${donde}.${campo} debe ser ≥ 0`);
    }
    if (r.multiplicadorPuntual !== undefined && !esNumero(r.multiplicadorPuntual, 1)) p.push(`${donde}.multiplicadorPuntual debe ser ≥ 1`);
    if (r.tramosDiarios !== undefined) {
      const tramos = r.tramosDiarios;
      const valido =
        Array.isArray(tramos) &&
        tramos.length > 0 &&
        tramos.every((t: unknown) => esObjeto(t) && (t.hasta === null || esNumero(t.hasta, 1)) && esNumero(t.factor)) &&
        (tramos[tramos.length - 1] as { hasta: unknown }).hasta === null;
      if (!valido) p.push(`${donde}.tramosDiarios inválido (el último tramo debe tener hasta: null)`);
    }
  });

  if (p.length > 0) throw new ConfiguracionInvalida(`Reglas del RPG inválidas:\n- ${p.join('\n- ')}`);
  return datos as unknown as ConfiguracionDeReglas;
}

export function indexarReglas(cfg: ConfiguracionDeReglas): ReadonlyMap<string, ReglaDeEvento> {
  return new Map(cfg.reglas.map((r) => [r.evento, r]));
}

/** XP antes de límites y multiplicadores. Talla desconocida → 0 (no se adivina). */
export function xpBase(regla: ReglaDeEvento, datos: Readonly<Record<string, unknown>>): number {
  if (regla.xp !== undefined) return regla.xp;
  const talla = datos.talla;
  if (talla === 'S' || talla === 'M' || talla === 'L') return regla.xpPorTalla?.[talla] ?? 0;
  return 0;
}

/** Aplica el tope diario: nunca negativo, nunca por encima de lo que falta para el tope. */
export function aplicarLimiteDiario(xp: number, acumuladoHoy: number, limite: number | undefined): number {
  if (limite === undefined) return xp;
  return Math.max(0, Math.min(xp, limite - acumuladoHoy));
}
