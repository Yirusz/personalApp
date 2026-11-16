/**
 * Tarea mientras Ludus está abierto, en cualquier pantalla (alIniciar):
 * - Programa un temporizador al fin previsto de la sesión y la completa (E5). Además
 *   revisa al volver a primer plano y cada 15 s, por si Android congeló el temporizador.
 * - Al completar con la app visible y a tiempo: tono, vibración y notificación (E3).
 *   Si se detecta más de un minuto tarde (app congelada o cerrada), no suena: al volver
 *   se ve el resultado en pantalla (ADR-0004).
 * - Muestra el tiempo restante en el título de la pestaña.
 * Las revisiones son idempotentes: con dos pestañas solo una completa y avisa.
 */
import type { ContextoDeModulo } from '../../../nucleo/contrato';
import { estaPausada, finPrevistoMs, restanteMs, type SesionTerminada } from '../dominio/sesion';
import { sonarTono, vibrar } from '../infraestructura/plataforma';
import { ESTADO, leerEstado } from './comun';
import { revisar } from './pomodoro';

export const REVISION_DE_SEGURIDAD_MS = 15_000;
/** Si se detecta más tarde que esto, la app estuvo congelada: no se suena al volver. */
export const TOLERANCIA_PARA_AVISAR_MS = 60_000;

/** Prefijo que ponemos en el título de la pestaña: "12:34 · " o "⏸ 12:34 · ". */
const PREFIJO = /^(⏸ )?\d+:\d\d · /;

export function textoRestante(ms: number): string {
  const s = Math.ceil(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function debeAvisar(t: SesionTerminada, ahoraMs: number): boolean {
  return t.estado === 'completada' && ahoraMs - Date.parse(t.finalizadaEn) <= TOLERANCIA_PARA_AVISAR_MS;
}

async function avisar(ctx: ContextoDeModulo, t: SesionTerminada, sonido: boolean): Promise<void> {
  if (sonido) sonarTono();
  vibrar();
  const clave = t.fase === 'foco' ? 'estudio.aviso.focoTerminado' : 'estudio.aviso.descansoTerminado';
  await ctx.notificaciones.mostrar({ titulo: ctx.t(clave), cuerpo: ctx.t(`${clave}Cuerpo`), etiqueta: 'ludus-estudio' });
}

export function iniciarTemporizador(ctx: ContextoDeModulo): () => void {
  let temporizador: ReturnType<typeof setTimeout> | undefined;
  let titulo: ReturnType<typeof setInterval> | undefined;
  let detenido = false;

  const limpiarTitulo = () => {
    if (titulo) clearInterval(titulo);
    titulo = undefined;
    if (typeof document !== 'undefined') document.title = document.title.replace(PREFIJO, '');
  };

  const comprobar = async () => {
    if (detenido) return;
    try {
      const terminada = await revisar(ctx);
      const estado = await ctx.almacen.leer([ESTADO], leerEstado);
      if (terminada && debeAvisar(terminada, ctx.reloj.ahora().getTime())) await avisar(ctx, terminada, estado.configuracion.sonido);
      programar(estado.activa);
    } catch (error) {
      ctx.diagnostico.registrar('error', 'estudio', 'No se pudo revisar el Pomodoro', error);
    }
  };

  const programar = (s: Awaited<ReturnType<typeof leerEstado>>['activa']) => {
    if (temporizador) clearTimeout(temporizador);
    temporizador = undefined;
    limpiarTitulo();
    if (!s) return;
    if (!estaPausada(s)) {
      const espera = Math.max(0, finPrevistoMs(s, ctx.reloj.ahora().getTime()) - ctx.reloj.ahora().getTime());
      temporizador = setTimeout(() => void comprobar(), espera + 50);
    }
    if (typeof document === 'undefined') return;
    const pintar = () => {
      const base = document.title.replace(PREFIJO, '');
      document.title = `${estaPausada(s) ? '⏸ ' : ''}${textoRestante(restanteMs(s, ctx.reloj.ahora().getTime()))} · ${base}`;
    };
    pintar();
    // Solo repinta: el tiempo siempre se calcula con el Reloj.
    if (!estaPausada(s)) titulo = setInterval(pintar, 1000);
  };

  const alCambiarEstado = () => {
    void ctx.almacen.leer([ESTADO], leerEstado).then((e) => !detenido && programar(e.activa));
  };
  const alVolver = () => {
    if (document.visibilityState === 'visible') void comprobar();
  };

  const dejar = ctx.almacen.alCambiar([ESTADO], alCambiarEstado);
  const seguridad = setInterval(() => void comprobar(), REVISION_DE_SEGURIDAD_MS);
  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', alVolver);
  void comprobar();

  return () => {
    detenido = true;
    dejar();
    clearInterval(seguridad);
    if (temporizador) clearTimeout(temporizador);
    limpiarTitulo();
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', alVolver);
  };
}
