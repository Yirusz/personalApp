/**
 * CA8: recordatorios. Con la app abierta (cualquier pantalla) se revisa cada 30 s
 * y al volver a primer plano; se notifica lo que venció desde la última revisión
 * (máx. 5 min atrás, para no lanzar una ráfaga al abrir). Lo demás queda en la
 * bandeja de Inicio hasta que el evento termina o se descarta.
 */
import type { ContextoDeModulo, TransaccionDeLectura } from '../../../nucleo/contrato';
import type { EventoDeCalendario } from '../dominio/evento';
import { ocurrenciasEnRango } from '../dominio/expansion';
import { avisosEntre, avisosPendientes, rangoParaAvisos, type Aviso } from '../dominio/recordatorios';
import type { Ocurrencia } from '../dominio/visible';
import { AVISOS, EVENTOS, zonaDelUsuario, type ContextoDeCasoDeUso, type EstadoDeAviso } from './comun';

export const INTERVALO_DE_REVISION_MS = 30_000;
const MAX_ATRAS_PARA_NOTIFICAR_MS = 5 * 60_000;
const RETENCION_MS = 30 * 86_400_000;

function ocurrenciasCercanas(eventos: readonly EventoDeCalendario[], ahoraMs: number): Ocurrencia[] {
  const zona = zonaDelUsuario();
  const rango = rangoParaAvisos(ahoraMs);
  return eventos.flatMap((e) => {
    try {
      return ocurrenciasEnRango(e, rango, zona);
    } catch {
      return []; // un evento dañado no impide los avisos de los demás
    }
  });
}

/** Bandeja "Recordatorios" de Inicio. */
export async function leerBandeja(tx: TransaccionDeLectura, ahoraMs: number): Promise<Aviso[]> {
  const [eventos, estados] = await Promise.all([tx.listar<EventoDeCalendario>(EVENTOS), tx.listar<EstadoDeAviso>(AVISOS)]);
  const descartados = new Set(estados.filter((s) => s.descartadoEn).map((s) => s.clave));
  return avisosPendientes(ocurrenciasCercanas(eventos, ahoraMs), ahoraMs, descartados);
}

export function descartarAvisos(ctx: ContextoDeCasoDeUso, avisos: readonly Pick<Aviso, 'clave' | 'momentoMs'>[]): Promise<void> {
  return ctx.almacen.escribir([AVISOS], async (tx) => {
    const ahora = ctx.reloj.ahora().toISOString();
    for (const a of avisos) {
      const previo = await tx.obtener<EstadoDeAviso>(AVISOS, a.clave);
      await tx.poner(AVISOS, { ...previo, clave: a.clave, momentoMs: a.momentoMs, descartadoEn: ahora } satisfies EstadoDeAviso);
    }
  });
}

/** Una revisión: notifica lo vencido en (desde, ahora] que no se haya notificado. Devuelve el nuevo "desde". */
export async function revisarRecordatorios(ctx: Pick<ContextoDeModulo, 'almacen' | 'reloj' | 'notificaciones' | 't' | 'formatos'>, desdeMs: number): Promise<number> {
  const ahoraMs = ctx.reloj.ahora().getTime();
  const desde = Math.max(desdeMs, ahoraMs - MAX_ATRAS_PARA_NOTIFICAR_MS);
  const eventos = await ctx.almacen.leer([EVENTOS], (tx) => tx.listar<EventoDeCalendario>(EVENTOS));
  const nuevos = avisosEntre(ocurrenciasCercanas(eventos, ahoraMs), desde, ahoraMs);
  if (nuevos.length === 0) return ahoraMs;
  const porNotificar = await ctx.almacen.escribir([AVISOS], async (tx) => {
    const lista: Aviso[] = [];
    for (const a of nuevos) {
      const previo = await tx.obtener<EstadoDeAviso>(AVISOS, a.clave);
      if (previo?.notificadoEn || previo?.descartadoEn) continue;
      await tx.poner(AVISOS, { ...previo, clave: a.clave, momentoMs: a.momentoMs, notificadoEn: new Date(ahoraMs).toISOString() } satisfies EstadoDeAviso);
      lista.push(a);
    }
    return lista;
  });
  for (const a of porNotificar) {
    await ctx.notificaciones.mostrar({
      titulo: a.titulo,
      cuerpo: a.todoElDia ? ctx.t('calendario.aviso.todoElDia', { fecha: ctx.formatos.fecha(new Date(a.inicioMs)) }) : ctx.t('calendario.aviso.cuerpo', { hora: ctx.formatos.hora(new Date(a.inicioMs)) }),
      etiqueta: a.clave,
    });
  }
  return ahoraMs;
}

/** Borra estados de avisos de hace más de 30 días. */
export function podarAvisos(ctx: ContextoDeCasoDeUso): Promise<void> {
  return ctx.almacen.escribir([AVISOS], async (tx) => {
    const limite = ctx.reloj.ahora().getTime() - RETENCION_MS;
    for (const s of await tx.listar<EstadoDeAviso>(AVISOS)) if (s.momentoMs < limite) await tx.borrar(AVISOS, s.clave);
  });
}

/** Tarea `alIniciar` del módulo: corre mientras la app está abierta. */
export function iniciarRecordatorios(ctx: ContextoDeModulo): () => void {
  let desde = ctx.reloj.ahora().getTime();
  let ocupado = false;
  const revisar = async () => {
    if (ocupado) return;
    ocupado = true;
    try {
      desde = await revisarRecordatorios(ctx, desde);
    } catch (error) {
      ctx.diagnostico.registrar('error', 'calendario', 'Falló la revisión de recordatorios', error);
    } finally {
      ocupado = false;
    }
  };
  void podarAvisos(ctx).catch((error: unknown) => ctx.diagnostico.registrar('aviso', 'calendario', 'No se pudieron podar los avisos', error));
  const temporizador = setInterval(() => void revisar(), INTERVALO_DE_REVISION_MS);
  const alVolver = () => document.visibilityState === 'visible' && void revisar();
  document.addEventListener('visibilitychange', alVolver);
  return () => {
    clearInterval(temporizador);
    document.removeEventListener('visibilitychange', alVolver);
  };
}
