/**
 * Agregado EventoDeCalendario (docs/dominio.md §3).
 * - Con hora: `inicio`/`fin` son instantes UTC ISO 8601.
 * - Todo el día: `inicio`/`fin` son fechas civiles `AAAA-MM-DD` (fin inclusivo), sin hora ni zona.
 * - Recurrente: `recurrencia` + `excepciones` por fecha civil original (cancelada o modificada).
 */
import { esColorDeAgenda, type ColorDeAgenda } from '../../../nucleo/dominio/color';
import { vinculo as vinculoValido, type Vinculo } from '../../../nucleo/dominio/fichas';
import { esFechaCivil, MS_DIA, MS_MINUTO, type Zona } from '../../../nucleo/dominio/zona-horaria';
import {
  ColorDeEventoInvalido,
  CompromisoInvalido,
  CumplimientoFueraDeTiempo,
  DuracionExcesiva,
  FechaDeEventoInvalida,
  FinAntesDeInicio,
  OcurrenciaInexistente,
  RecordatorioInvalido,
  RecurrenciaInvalida,
  TextoDemasiadoLargo,
  TituloDeEventoInvalido,
  VinculoInvalido,
} from './errores';
import { instanciar } from './expansion';
import { diferenciaDias, sumarDias } from './fechas';
import { esOcurrencia, primeraFecha, validarRecurrencia, type Recurrencia } from './recurrencia';

export const TITULO_MAX = 120;
export const LUGAR_MAX = 200;
export const NOTAS_MAX = 5000;
export const DIAS_MAX = 14;
export const RECORDATORIOS_MAX = 5;
export const RECORDATORIO_MAX_MIN = 40_320; // 4 semanas
export const COMPROMISO_MIN_MIN = 15;
export const COMPROMISO_MAX_MIN = 480;
/** Plazo para marcar un bloque de compromiso como cumplido después de que termina. */
export const HORAS_PARA_CUMPLIR = 48;

export interface DatosDeOcurrencia {
  titulo: string;
  lugar: string;
  notas: string;
  inicio: string;
  fin: string;
}

export type Excepcion = { cancelada: true } | ({ cancelada: false } & DatosDeOcurrencia);

export interface DatosDeEvento extends DatosDeOcurrencia {
  color: ColorDeAgenda;
  todoElDia: boolean;
  recordatorios: number[];
  recurrencia: Recurrencia | null;
  compromiso: boolean;
  /** Entidad de otro módulo (H9); ausente en datos viejos = null. */
  vinculo?: Vinculo | null;
  /** `<modulo>:<fichaId>` con la que se creó (H8). */
  ficha?: string | null;
}

export interface EventoDeCalendario extends DatosDeEvento {
  readonly id: string;
  /** UID de iCalendar: estable, para exportar e importar sin duplicar. */
  readonly uid: string;
  readonly excepciones: Readonly<Record<string, Excepcion>>;
  /** Claves (fecha original) de ocurrencias marcadas como cumplidas. */
  readonly cumplidas: readonly string[];
  readonly creadoEn: string;
  readonly actualizadoEn: string;
}

const PATRON_INSTANTE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;

export const FICHA_CLAVE_MAX = 200;

function texto(valor: string): string {
  return valor.normalize('NFC').trim();
}

export function titulo(valor: string): string {
  const limpio = texto(valor).replace(/\s+/g, ' ');
  if (!limpio) throw new TituloDeEventoInvalido('vacio', TITULO_MAX);
  if (limpio.length > TITULO_MAX) throw new TituloDeEventoInvalido('largo', TITULO_MAX);
  return limpio;
}

function opcional(valor: string, campo: 'lugar' | 'notas', max: number): string {
  const limpio = texto(valor ?? '');
  if (limpio.length > max) throw new TextoDemasiadoLargo(campo, max);
  return limpio;
}

/** Valida y normaliza el intervalo según sea de todo el día o con hora. */
export function intervalo(todoElDia: boolean, inicio: string, fin: string): { inicio: string; fin: string } {
  if (todoElDia) {
    if (!esFechaCivil(inicio)) throw new FechaDeEventoInvalida('inicio', `Fecha de inicio inválida: ${inicio}`);
    if (!esFechaCivil(fin)) throw new FechaDeEventoInvalida('fin', `Fecha de fin inválida: ${fin}`);
    if (fin < inicio) throw new FinAntesDeInicio('El último día es anterior al primero');
    if (diferenciaDias(inicio, fin) + 1 > DIAS_MAX) throw new DuracionExcesiva(`Más de ${DIAS_MAX} días`);
    return { inicio, fin };
  }
  const a = PATRON_INSTANTE.test(inicio) ? Date.parse(inicio) : NaN;
  const b = PATRON_INSTANTE.test(fin) ? Date.parse(fin) : NaN;
  if (Number.isNaN(a)) throw new FechaDeEventoInvalida('inicio', `Inicio inválido: ${inicio}`);
  if (Number.isNaN(b)) throw new FechaDeEventoInvalida('fin', `Fin inválido: ${fin}`);
  if (b <= a) throw new FinAntesDeInicio('La hora de fin debe ser posterior al inicio');
  if (b - a > DIAS_MAX * MS_DIA) throw new DuracionExcesiva(`Más de ${DIAS_MAX} días`);
  return { inicio: new Date(a).toISOString(), fin: new Date(b).toISOString() };
}

function recordatorios(lista: readonly number[]): number[] {
  const unicos = [...new Set(lista)].sort((a, b) => a - b);
  if (unicos.length > RECORDATORIOS_MAX) throw new RecordatorioInvalido(`Máximo ${RECORDATORIOS_MAX} recordatorios`);
  if (unicos.some((m) => !Number.isInteger(m) || m < 0 || m > RECORDATORIO_MAX_MIN)) throw new RecordatorioInvalido('Recordatorio fuera de rango');
  return unicos;
}

/** Fecha civil (zona del usuario) en que empieza el evento: clave de su primera ocurrencia. */
export function fechaBase(e: Pick<DatosDeEvento, 'todoElDia' | 'inicio'>, zona: Zona): string {
  return e.todoElDia ? e.inicio : zona.aCivil(Date.parse(e.inicio)).fecha;
}

/** Mueve el intervalo para que empiece en `fecha` (misma hora local y duración). */
function moverA(datos: { todoElDia: boolean; inicio: string; fin: string }, fecha: string, zona: Zona) {
  if (datos.todoElDia) {
    const dias = diferenciaDias(datos.inicio, fecha);
    return { inicio: fecha, fin: sumarDias(datos.fin, dias) };
  }
  const inicioMs = Date.parse(datos.inicio);
  const duracion = Date.parse(datos.fin) - inicioMs;
  const nuevo = zona.aUtc(fecha, zona.aCivil(inicioMs).minutos);
  return { inicio: new Date(nuevo).toISOString(), fin: new Date(nuevo + duracion).toISOString() };
}

function validarDatos(d: DatosDeEvento, zona: Zona): DatosDeEvento {
  if (!esColorDeAgenda(d.color)) throw new ColorDeEventoInvalido(`Color inválido: ${String(d.color)}`);
  let vinculo: Vinculo | null = null;
  if (d.vinculo) {
    try {
      vinculo = vinculoValido(d.vinculo);
    } catch {
      throw new VinculoInvalido('Vínculo mal formado');
    }
  }
  const ficha = typeof d.ficha === 'string' && d.ficha && d.ficha.length <= FICHA_CLAVE_MAX ? d.ficha : null;
  let { inicio, fin } = intervalo(d.todoElDia, d.inicio, d.fin);
  let recurrencia: Recurrencia | null = null;
  if (d.recurrencia) {
    recurrencia = validarRecurrencia(d.recurrencia);
    const base = fechaBase({ todoElDia: d.todoElDia, inicio }, zona);
    const primera = primeraFecha(base, recurrencia);
    if (primera !== base) ({ inicio, fin } = moverA({ todoElDia: d.todoElDia, inicio, fin }, primera, zona));
    if (recurrencia.fin.tipo === 'fecha' && recurrencia.fin.hasta < primera) throw new RecurrenciaInvalida('La repetición termina antes de empezar');
  }
  if (d.compromiso) {
    if (d.todoElDia) throw new CompromisoInvalido('Un bloque de compromiso necesita hora');
    const minutos = (Date.parse(fin) - Date.parse(inicio)) / MS_MINUTO;
    if (minutos < COMPROMISO_MIN_MIN || minutos > COMPROMISO_MAX_MIN) throw new CompromisoInvalido('Duración del bloque fuera de 15 min – 8 h');
  }
  return {
    titulo: titulo(d.titulo),
    lugar: opcional(d.lugar, 'lugar', LUGAR_MAX),
    notas: opcional(d.notas, 'notas', NOTAS_MAX),
    color: d.color.toLowerCase() as ColorDeAgenda,
    todoElDia: d.todoElDia,
    inicio,
    fin,
    recordatorios: recordatorios(d.recordatorios),
    recurrencia,
    compromiso: d.compromiso,
    vinculo,
    ficha,
  };
}

export function crearEvento(d: DatosDeEvento & { id: string; uid?: string }, zona: Zona, ahora: Date): EventoDeCalendario {
  const instante = ahora.toISOString();
  return {
    id: d.id,
    uid: d.uid ?? `${d.id}@ludus`,
    ...validarDatos(d, zona),
    excepciones: {},
    cumplidas: [],
    creadoEn: instante,
    actualizadoEn: instante,
  };
}

/** Clave válida de ocurrencia de este evento. */
export function esClaveDeOcurrencia(e: EventoDeCalendario, clave: string, zona: Zona): boolean {
  const base = fechaBase(e, zona);
  return e.recurrencia ? esOcurrencia(base, e.recurrencia, clave) : clave === base;
}

/**
 * Edita toda la serie. Se conservan las excepciones y cumplimientos cuyas fechas
 * siguen siendo ocurrencias; las demás se descartan.
 */
export function editarEvento(e: EventoDeCalendario, d: DatosDeEvento, zona: Zona, ahora: Date): EventoDeCalendario {
  const nuevo: EventoDeCalendario = { ...e, ...validarDatos(d, zona), actualizadoEn: ahora.toISOString() };
  const vale = (clave: string) => esClaveDeOcurrencia(nuevo, clave, zona);
  return {
    ...nuevo,
    excepciones: nuevo.recurrencia ? Object.fromEntries(Object.entries(e.excepciones).filter(([k]) => vale(k))) : {},
    cumplidas: e.cumplidas.filter(vale),
  };
}

function exigirOcurrenciaDeSerie(e: EventoDeCalendario, clave: string, zona: Zona): void {
  if (!e.recurrencia || !esClaveDeOcurrencia(e, clave, zona)) throw new OcurrenciaInexistente(`No hay ocurrencia el ${clave}`);
}

/** Borra solo una ocurrencia (fecha excluida, EXDATE). */
export function cancelarOcurrencia(e: EventoDeCalendario, clave: string, ahora: Date, zona: Zona): EventoDeCalendario {
  exigirOcurrenciaDeSerie(e, clave, zona);
  return { ...e, excepciones: { ...e.excepciones, [clave]: { cancelada: true } }, actualizadoEn: ahora.toISOString() };
}

/** Quita la excepción de una ocurrencia, o devuelve la que tenía antes (para deshacer). */
export function restaurarOcurrencia(e: EventoDeCalendario, clave: string, ahora: Date, anterior?: Excepcion): EventoDeCalendario {
  const { [clave]: _quitada, ...resto } = e.excepciones;
  return { ...e, excepciones: anterior ? { ...resto, [clave]: anterior } : resto, actualizadoEn: ahora.toISOString() };
}

/** Edita solo una ocurrencia (excepción con su propio título, lugar, notas y horario). */
export function editarOcurrencia(e: EventoDeCalendario, clave: string, d: DatosDeOcurrencia, ahora: Date, zona: Zona): EventoDeCalendario {
  exigirOcurrenciaDeSerie(e, clave, zona);
  const { inicio, fin } = intervalo(e.todoElDia, d.inicio, d.fin);
  const excepcion: Excepcion = {
    cancelada: false,
    titulo: titulo(d.titulo),
    lugar: opcional(d.lugar, 'lugar', LUGAR_MAX),
    notas: opcional(d.notas, 'notas', NOTAS_MAX),
    inicio,
    fin,
  };
  return { ...e, excepciones: { ...e.excepciones, [clave]: excepcion }, actualizadoEn: ahora.toISOString() };
}

/** Bloque de compromiso: se marca cumplido desde que empieza hasta 48 h después de terminar, una vez. */
export function marcarCumplida(e: EventoDeCalendario, clave: string, ahora: Date, zona: Zona): EventoDeCalendario {
  if (!e.compromiso) throw new CompromisoInvalido('El evento no es un bloque de compromiso');
  if (!esClaveDeOcurrencia(e, clave, zona)) throw new OcurrenciaInexistente(`No hay ocurrencia el ${clave}`);
  const o = instanciar(e, clave, zona);
  const t = ahora.getTime();
  if (!o || e.cumplidas.includes(clave) || t < o.inicioMs || t > o.finMs + HORAS_PARA_CUMPLIR * 3_600_000) {
    throw new CumplimientoFueraDeTiempo('Solo se marca una vez, desde que empieza hasta 48 h después');
  }
  return { ...e, cumplidas: [...e.cumplidas, clave].sort(), actualizadoEn: ahora.toISOString() };
}

export function desmarcarCumplida(e: EventoDeCalendario, clave: string, ahora: Date): EventoDeCalendario {
  return { ...e, cumplidas: e.cumplidas.filter((c) => c !== clave), actualizadoEn: ahora.toISOString() };
}
