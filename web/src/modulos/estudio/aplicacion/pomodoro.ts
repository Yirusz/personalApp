/**
 * Casos de uso del Pomodoro (E1, E2, E5). Cada uno lee y escribe en UNA transacción:
 * IndexedDB las serializa, así que con dos pestañas o al volver de un congelamiento
 * solo una completa la sesión y publica el evento.
 */
import type { Transaccion } from '../../../nucleo/contrato';
import type { Vinculo } from '../../../nucleo/dominio/fichas';
import { validarConfiguracion, type ConfiguracionPomodoro } from '../dominio/configuracion';
import { ErrorDeEstudio } from '../dominio/errores';
import {
  completar,
  estaVencida,
  iniciar,
  interrumpir,
  pausar as pausarSesion,
  reanudar as reanudarSesion,
  saltar,
  siguiente,
  type Fase,
  type SesionActiva,
  type SesionTerminada,
} from '../dominio/sesion';
import {
  CLAVE_ACTIVA,
  CLAVE_CONFIGURACION,
  duracionDe,
  ESTADO,
  leerEstado,
  PUBLICADOS,
  SESIONES,
  zonaDelUsuario,
  type ContextoDeCasoDeUso,
  type EstadoDeEstudio,
  type RegistroDeCiclo,
} from './comun';

const ALMACENES = [ESTADO, SESIONES];

/** Guarda lo terminado, avanza el ciclo y publica (con ocurridoEn = fin real). */
async function cerrar(tx: Transaccion, estado: EstadoDeEstudio, t: SesionTerminada): Promise<SesionTerminada> {
  await tx.poner(SESIONES, t);
  await tx.borrar(ESTADO, CLAVE_ACTIVA);
  const p = siguiente(estado.configuracion, estado.ciclo, t.fase, t.estado);
  await tx.poner(ESTADO, { ...estado.ciclo, ...p.ciclo, proxima: p.fase, ultima: { fase: t.fase, estado: t.estado, finalizadaEn: t.finalizadaEn } } satisfies RegistroDeCiclo);
  const opciones = { ocurridoEn: t.finalizadaEn };
  if (t.fase === 'foco' && t.estado === 'completada') {
    tx.publicar(PUBLICADOS.PomodoroCompletado, { sesionId: t.id, vinculo: t.vinculo, minutosFoco: t.minutosEfectivos, iniciadaEn: t.iniciadaEn }, opciones);
  } else if (t.fase === 'foco') {
    tx.publicar(PUBLICADOS.PomodoroInterrumpido, { sesionId: t.id, vinculo: t.vinculo, minutosFoco: t.minutosEfectivos }, opciones);
  } else if (t.estado === 'completada') {
    tx.publicar(PUBLICADOS.DescansoCompletado, { sesionId: t.id, tipo: t.fase, minutos: t.minutosEfectivos }, opciones);
  }
  return t;
}

/** Inicia la fase propuesta (o la indicada) con la duración de la configuración actual. */
export function iniciarFase(ctx: ContextoDeCasoDeUso, opciones: { vinculo: Vinculo | null; fase?: Fase }): Promise<SesionActiva> {
  return ctx.almacen.escribir(ALMACENES, async (tx) => {
    const estado = await leerEstado(tx);
    if (estado.activa) throw new ErrorDeEstudio('estudio.error.enCurso', 'Ya hay una sesión en curso');
    const fase = opciones.fase ?? estado.ciclo.proxima;
    const s = iniciar({ id: ctx.nuevoId(), fase, duracionMin: duracionDe(estado.configuracion, fase), vinculo: opciones.vinculo, ahora: ctx.reloj.ahora() });
    await tx.poner(ESTADO, { clave: CLAVE_ACTIVA, sesion: s });
    return s;
  });
}

async function conActiva<R>(ctx: ContextoDeCasoDeUso, fn: (tx: Transaccion, estado: EstadoDeEstudio, s: SesionActiva) => Promise<R>): Promise<R> {
  return ctx.almacen.escribir(ALMACENES, async (tx) => {
    const estado = await leerEstado(tx);
    if (!estado.activa) throw new ErrorDeEstudio('estudio.error.sinSesion', 'No hay sesión en curso');
    return fn(tx, estado, estado.activa);
  });
}

export const pausar = (ctx: ContextoDeCasoDeUso) =>
  conActiva(ctx, async (tx, _e, s) => {
    const nueva = pausarSesion(s, ctx.reloj.ahora());
    await tx.poner(ESTADO, { clave: CLAVE_ACTIVA, sesion: nueva });
    return nueva;
  });

export const reanudar = (ctx: ContextoDeCasoDeUso) =>
  conActiva(ctx, async (tx, _e, s) => {
    const nueva = reanudarSesion(s, ctx.reloj.ahora());
    await tx.poner(ESTADO, { clave: CLAVE_ACTIVA, sesion: nueva });
    return nueva;
  });

/** Cambiar la materia o el trabajo del foco en curso. */
export const cambiarVinculo = (ctx: ContextoDeCasoDeUso, vinculo: Vinculo | null) =>
  conActiva(ctx, async (tx, _e, s) => {
    const nueva = iniciar({ ...s, vinculo, ahora: new Date(s.iniciadaEn) });
    await tx.poner(ESTADO, { clave: CLAVE_ACTIVA, sesion: { ...nueva, pausas: s.pausas } });
    return nueva;
  });

/**
 * Detener: un foco antes de tiempo → interrumpido (sin XP); un descanso → saltado.
 * Si ya había terminado (se tocó justo al final), se completa.
 */
export const detener = (ctx: ContextoDeCasoDeUso) =>
  conActiva(ctx, async (tx, estado, s) => {
    const ahora = ctx.reloj.ahora();
    const zona = zonaDelUsuario();
    if (estaVencida(s, ahora.getTime())) return cerrar(tx, estado, completar(s, ahora, zona));
    return cerrar(tx, estado, s.fase === 'foco' ? interrumpir(s, ahora, zona) : saltar(s, ahora, zona));
  });

/**
 * Completa la sesión si ya venció (E5). Idempotente: si no hay sesión o no ha vencido,
 * no hace nada. Devuelve lo completado, o null.
 */
export function revisar(ctx: ContextoDeCasoDeUso): Promise<SesionTerminada | null> {
  return ctx.almacen.escribir(ALMACENES, async (tx) => {
    const estado = await leerEstado(tx);
    const s = estado.activa;
    const ahora = ctx.reloj.ahora();
    if (!s || !estaVencida(s, ahora.getTime())) return null;
    return cerrar(tx, estado, completar(s, ahora, zonaDelUsuario()));
  });
}

/** E2: las próximas fases usan estos valores; la sesión en curso no cambia. */
export function guardarConfiguracion(ctx: ContextoDeCasoDeUso, cfg: ConfiguracionPomodoro): Promise<ConfiguracionPomodoro> {
  return ctx.almacen.escribir([ESTADO], async (tx) => {
    const valida = validarConfiguracion(cfg);
    await tx.poner(ESTADO, { clave: CLAVE_CONFIGURACION, ...valida });
    return valida;
  });
}

/** Volver a empezar el ciclo (el próximo es un foco). */
export function reiniciarCiclo(ctx: ContextoDeCasoDeUso): Promise<void> {
  return ctx.almacen.escribir([ESTADO], async (tx) => {
    const estado = await leerEstado(tx);
    await tx.poner(ESTADO, { ...estado.ciclo, focosEnCiclo: 0, proxima: 'foco' } satisfies RegistroDeCiclo);
  });
}
