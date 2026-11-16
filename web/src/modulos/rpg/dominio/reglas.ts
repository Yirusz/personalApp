/**
 * Configuración de reglas del RPG (ADR-0005). Se valida al arrancar: una
 * configuración inválida detiene la app con un mensaje claro (falla rápido).
 *
 * El motor aplica `xp`, `xpPorTalla`, `xpPorValor`, `xpDesdeDato`, `bonoPorUmbral`,
 * `limiteDiarioXp`, `unaVezPor`, `minMinutosDesdeCreacion`, `minAntelacionHoras`,
 * `multiplicadorPuntual`, `tramosDiarios` y el multiplicador de racha (iteración 6).
 * Los contadores y logros también viven aquí (configuración, no código).
 */
import { PATRON_TIPO_EVENTO } from '../../../nucleo/dominio/evento';
import { multiplicadorDeRacha } from './racha';

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
  /** XP según el valor de un campo de `datos` (p. ej. el tipo de trabajo). Valor desconocido → 0. */
  xpPorValor?: { campo: string; valores: Record<string, number> };
  /** XP = valor numérico de `datos[campo]` (solo para eventos propios del RPG, p. ej. logros). */
  xpDesdeDato?: string;
  /** × si `datos[campo]` (numérico) es ≥ `minimo` (p. ej. peso ≥ 20 %). */
  bonoPorUmbral?: { campo: string; minimo: number; multiplicador: number };
  limiteDiarioXp?: number;
  /** × si `datos.aTiempo === true`. */
  multiplicadorPuntual?: number;
  /** 0 XP si `datos.minutosDesdeCreacion` es menor (o falta). */
  minMinutosDesdeCreacion?: number;
  /** 0 XP si `datos.antelacionHoras` es menor (o falta). */
  minAntelacionHoras?: number;
  /** Campo de `datos` que identifica la entidad: a lo sumo un asiento con XP por valor. */
  unaVezPor?: string;
  /** Factor según cuántos eventos de este tipo hubo antes en el mismo día (rendimiento decreciente). */
  tramosDiarios?: TramoDiario[];
  /** No aplica el multiplicador de racha (p. ej. el propio bono de racha y los logros). */
  sinMultiplicadorDeRacha?: boolean;
}

/** Cuenta eventos para los logros. `donde`: igualdad sobre campos de datos; `unaVezPor`: una vez por entidad. */
export interface Contador {
  id: string;
  evento: string;
  donde?: Record<string, string | number | boolean>;
  unaVezPor?: string;
}

export type CondicionDeLogro = { contador: string; minimo: number; ambito?: 'total' | 'dia' } | { racha: number };

export interface Logro {
  id: string;
  /** XP al desbloquearlo (vía rpg.LogroDesbloqueado). Nombre y descripción: `rpg.logro.<id>` en textos. */
  xp: number;
  condiciones: CondicionDeLogro[];
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
  /** R6: misma fórmula, otros parámetros, para el nivel de cada atributo. */
  nivelDeAtributo: { base: number; exponente: number };
  oro: { xpPorOro: number };
  atributos: string[];
  racha: ConfiguracionDeRacha;
  reglas: ReglaDeEvento[];
  contadores: Contador[];
  logros: Logro[];
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
  const na = datos.nivelDeAtributo;
  if (!esObjeto(na) || !esNumero(na.base, 1) || !esNumero(na.exponente, 1)) p.push('nivelDeAtributo.base y .exponente deben ser ≥ 1');
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
    const tieneValor = r.xpPorValor !== undefined;
    const tieneDato = r.xpDesdeDato !== undefined;
    if (Number(tieneXp) + Number(tieneTalla) + Number(tieneValor) + Number(tieneDato) !== 1) p.push(`${donde}: debe tener exactamente uno de xp, xpPorTalla, xpPorValor o xpDesdeDato`);
    if (tieneDato && (typeof r.xpDesdeDato !== 'string' || !String(r.evento).startsWith('rpg.'))) p.push(`${donde}.xpDesdeDato solo para eventos rpg.*`);
    if (tieneValor) {
      const v = r.xpPorValor;
      if (!esObjeto(v) || typeof v.campo !== 'string' || !esObjeto(v.valores) || !Object.values(v.valores).every((x) => esNumero(x))) p.push(`${donde}.xpPorValor inválido`);
    }
    if (r.bonoPorUmbral !== undefined) {
      const b = r.bonoPorUmbral;
      if (!esObjeto(b) || typeof b.campo !== 'string' || !esNumero(b.minimo) || !esNumero(b.multiplicador, 1)) p.push(`${donde}.bonoPorUmbral inválido`);
    }
    if (tieneXp && !esNumero(r.xp)) p.push(`${donde}.xp debe ser ≥ 0`);
    if (tieneTalla && (!esObjeto(r.xpPorTalla) || !Object.values(r.xpPorTalla).every((v) => esNumero(v)))) {
      p.push(`${donde}.xpPorTalla inválido`);
    }
    for (const campo of ['limiteDiarioXp', 'minMinutosDesdeCreacion', 'minAntelacionHoras'] as const) {
      if (r[campo] !== undefined && !esNumero(r[campo])) p.push(`${donde}.${campo} debe ser ≥ 0`);
    }
    if (r.unaVezPor !== undefined && (typeof r.unaVezPor !== 'string' || r.unaVezPor.length === 0)) {
      p.push(`${donde}.unaVezPor debe ser el nombre de un campo de datos`);
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

  const contadores = Array.isArray(datos.contadores) ? datos.contadores : [];
  if (!Array.isArray(datos.contadores)) p.push('contadores debe ser una lista');
  const idsDeContador = new Set<string>();
  contadores.forEach((c: unknown, i) => {
    const donde = `contadores[${i}]`;
    if (!esObjeto(c) || typeof c.id !== 'string' || !c.id) return p.push(`${donde} sin id`);
    if (idsDeContador.has(c.id)) p.push(`${donde}: id repetido ${c.id}`);
    idsDeContador.add(c.id);
    if (typeof c.evento !== 'string' || !PATRON_TIPO_EVENTO.test(c.evento)) p.push(`${donde}.evento inválido`);
    if (c.donde !== undefined && (!esObjeto(c.donde) || !Object.values(c.donde).every((v) => ['string', 'number', 'boolean'].includes(typeof v)))) p.push(`${donde}.donde inválido`);
    if (c.unaVezPor !== undefined && typeof c.unaVezPor !== 'string') p.push(`${donde}.unaVezPor inválido`);
  });
  const logros = Array.isArray(datos.logros) ? datos.logros : [];
  if (!Array.isArray(datos.logros)) p.push('logros debe ser una lista');
  const idsDeLogro = new Set<string>();
  logros.forEach((l: unknown, i) => {
    const donde = `logros[${i}]`;
    if (!esObjeto(l) || typeof l.id !== 'string' || !/^[a-z0-9-]+$/.test(l.id)) return p.push(`${donde}.id inválido (minúsculas, números y guiones)`);
    if (idsDeLogro.has(l.id)) p.push(`${donde}: id repetido ${l.id}`);
    idsDeLogro.add(l.id);
    if (!esNumero(l.xp)) p.push(`${donde}.xp debe ser ≥ 0`);
    if (!Array.isArray(l.condiciones) || l.condiciones.length === 0) return p.push(`${donde}.condiciones vacías`);
    for (const c of l.condiciones as unknown[]) {
      if (esObjeto(c) && c.racha !== undefined) {
        if (!esNumero(c.racha, 1)) p.push(`${donde}: racha debe ser ≥ 1`);
      } else if (!esObjeto(c) || typeof c.contador !== 'string' || !idsDeContador.has(c.contador)) p.push(`${donde}: contador desconocido ${esObjeto(c) ? String(c.contador) : ''}`);
      else if (!esNumero(c.minimo, 1) || (c.ambito !== undefined && c.ambito !== 'total' && c.ambito !== 'dia')) p.push(`${donde}: condición inválida`);
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
  if (regla.xpDesdeDato !== undefined) {
    const v = datos[regla.xpDesdeDato];
    return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : 0;
  }
  if (regla.xpPorValor) {
    const valor = datos[regla.xpPorValor.campo];
    return typeof valor === 'string' && Object.hasOwn(regla.xpPorValor.valores, valor) ? regla.xpPorValor.valores[valor]! : 0;
  }
  const talla = datos.talla;
  if (talla === 'S' || talla === 'M' || talla === 'L') return regla.xpPorTalla?.[talla] ?? 0;
  return 0;
}

/** Aplica el tope diario: nunca negativo, nunca por encima de lo que falta para el tope. */
export function aplicarLimiteDiario(xp: number, acumuladoHoy: number, limite: number | undefined): number {
  if (limite === undefined) return xp;
  return Math.max(0, Math.min(xp, limite - acumuladoHoy));
}

export type NotaDeAsiento = 'limite-diario' | 'ya-otorgado' | 'muy-rapido' | 'poca-antelacion' | 'tramo-reducido';

/** Factor del tramo para el evento número `cantidadPrevia + 1` del día. */
export function factorDeTramo(tramos: readonly TramoDiario[] | undefined, cantidadPrevia: number): number {
  if (!tramos) return 1;
  const n = cantidadPrevia + 1;
  return (tramos.find((t) => t.hasta === null || n <= t.hasta) ?? tramos[tramos.length - 1]!).factor;
}

export interface CalculoDeXp {
  /** XP de la regla antes de condiciones, multiplicadores y topes. */
  xpBase: number;
  xp: number;
  /** Por qué se otorgó menos de lo esperado, si aplica. */
  nota?: NotaDeAsiento;
}

export interface HistoriaParaElCalculo {
  /** XP ya otorgada hoy por este tipo de evento. */
  acumuladoHoy: number;
  /** Si la entidad de `unaVezPor` ya otorgó XP antes. */
  yaOtorgado: boolean;
  /** Cuántos eventos de este tipo hubo antes hoy (para `tramosDiarios`); 0 si se omite. */
  cantidadHoy?: number;
  /** Racha vigente en la semana del evento (multiplicador); 0 si se omite. */
  semanasDeRacha?: number;
  /** Configuración de racha (para el multiplicador); sin ella no se multiplica. */
  racha?: Parameters<typeof multiplicadorDeRacha>[1];
}

/** Clave de idempotencia de negocio (`<evento>|<valor>`) cuando la regla tiene `unaVezPor`. */
export function claveUnica(regla: ReglaDeEvento, datos: Readonly<Record<string, unknown>>): string | undefined {
  if (!regla.unaVezPor) return undefined;
  const valor = datos[regla.unaVezPor];
  return typeof valor === 'string' || typeof valor === 'number' ? `${regla.evento}|${valor}` : undefined;
}

const numeroEn = (datos: Readonly<Record<string, unknown>>, campo: string): number | undefined => {
  const v = datos[campo];
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
};

/**
 * Orden de cálculo (docs/gamificacion.md §3): base → condiciones → puntualidad y bono →
 * tramos diarios → racha → tope diario → redondeo hacia abajo.
 * Un dato que falta no se adivina: la condición se considera no cumplida.
 */
export function calcularXp(regla: ReglaDeEvento, datos: Readonly<Record<string, unknown>>, historia: HistoriaParaElCalculo): CalculoDeXp {
  const base = xpBase(regla, datos);
  const cero = (nota: NotaDeAsiento): CalculoDeXp => ({ xpBase: base, xp: 0, nota });

  if (regla.minMinutosDesdeCreacion !== undefined) {
    const minutos = numeroEn(datos, 'minutosDesdeCreacion');
    if (minutos === undefined || minutos < regla.minMinutosDesdeCreacion) return cero('muy-rapido');
  }
  if (regla.minAntelacionHoras !== undefined) {
    const horas = numeroEn(datos, 'antelacionHoras');
    if (horas === undefined || horas < regla.minAntelacionHoras) return cero('poca-antelacion');
  }
  if (regla.unaVezPor !== undefined && historia.yaOtorgado) return cero('ya-otorgado');

  let xp = base;
  if (regla.multiplicadorPuntual !== undefined && datos.aTiempo === true) xp *= regla.multiplicadorPuntual;
  if (regla.bonoPorUmbral) {
    const v = datos[regla.bonoPorUmbral.campo];
    if (typeof v === 'number' && v >= regla.bonoPorUmbral.minimo) xp *= regla.bonoPorUmbral.multiplicador;
  }
  const factor = factorDeTramo(regla.tramosDiarios, historia.cantidadHoy ?? 0);
  xp *= factor;
  if (!regla.sinMultiplicadorDeRacha && historia.racha) xp *= multiplicadorDeRacha(historia.semanasDeRacha ?? 0, historia.racha);
  // Redondeo hacia abajo tolerante al error de coma flotante (35 × 1,2 = 41,999…).
  xp = Math.floor(Math.round(xp * 1e6) / 1e6);

  const conTope = aplicarLimiteDiario(xp, historia.acumuladoHoy, regla.limiteDiarioXp);
  if (conTope < xp) return { xpBase: base, xp: conTope, nota: 'limite-diario' };
  return factor < 1 ? { xpBase: base, xp, nota: 'tramo-reducido' } : { xpBase: base, xp };
}
