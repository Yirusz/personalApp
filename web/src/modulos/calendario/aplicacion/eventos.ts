/**
 * Casos de uso de eventos propios (CA1, CA5–CA7, CA12). Uno por función; cada
 * uno guarda y publica en la misma transacción.
 */
import {
  cancelarOcurrencia as cancelar,
  crearEvento as crear,
  desmarcarCumplida,
  editarEvento as editar,
  editarOcurrencia as editarUna,
  marcarCumplida,
  restaurarOcurrencia as restaurar,
  type DatosDeEvento,
  type DatosDeOcurrencia,
  type EventoDeCalendario,
  type Excepcion,
} from '../dominio/evento';
import { instanciar } from '../dominio/expansion';
import { EVENTOS, obtenerEvento, PUBLICADOS, zonaDelUsuario, type ContextoDeCasoDeUso } from './comun';

export function crearEvento(ctx: ContextoDeCasoDeUso, datos: DatosDeEvento): Promise<EventoDeCalendario> {
  return ctx.almacen.escribir([EVENTOS], async (tx) => {
    const e = crear({ ...datos, id: ctx.nuevoId() }, zonaDelUsuario(), ctx.reloj.ahora());
    await tx.poner(EVENTOS, e);
    tx.publicar(PUBLICADOS.EventoCreado, { eventoId: e.id, recurrente: e.recurrencia !== null, compromiso: e.compromiso });
    return e;
  });
}

/** Edita el evento o toda su serie. */
export function editarEvento(ctx: ContextoDeCasoDeUso, id: string, datos: DatosDeEvento): Promise<EventoDeCalendario> {
  return ctx.almacen.escribir([EVENTOS], async (tx) => {
    const e = editar(await obtenerEvento(tx, id), datos, zonaDelUsuario(), ctx.reloj.ahora());
    await tx.poner(EVENTOS, e);
    tx.publicar(PUBLICADOS.EventoEditado, { eventoId: id });
    return e;
  });
}

/** Elimina el evento o toda su serie. La UI lo llama al vencer el "Deshacer". Si ya no existe, no hace nada. */
export function eliminarEvento(ctx: ContextoDeCasoDeUso, id: string): Promise<void> {
  return ctx.almacen.escribir([EVENTOS], async (tx) => {
    if (!(await tx.obtener(EVENTOS, id))) return;
    await tx.borrar(EVENTOS, id);
    tx.publicar(PUBLICADOS.EventoEliminado, { eventoId: id });
  });
}

/** Borra solo una ocurrencia. Devuelve la excepción que tenía antes, para poder deshacer. */
export function cancelarOcurrencia(ctx: ContextoDeCasoDeUso, id: string, ocurrencia: string): Promise<Excepcion | undefined> {
  return ctx.almacen.escribir([EVENTOS], async (tx) => {
    const actual = await obtenerEvento(tx, id);
    const anterior = actual.excepciones[ocurrencia];
    await tx.poner(EVENTOS, cancelar(actual, ocurrencia, ctx.reloj.ahora(), zonaDelUsuario()));
    tx.publicar(PUBLICADOS.OcurrenciaModificada, { eventoId: id, ocurrencia, accion: 'cancelada' });
    return anterior;
  });
}

/** Deshace la cancelación (o vuelve a la versión original de la ocurrencia). */
export function restaurarOcurrencia(ctx: ContextoDeCasoDeUso, id: string, ocurrencia: string, anterior?: Excepcion): Promise<void> {
  return ctx.almacen.escribir([EVENTOS], async (tx) => {
    const e = await tx.obtener<EventoDeCalendario>(EVENTOS, id);
    if (!e) return;
    await tx.poner(EVENTOS, restaurar(e, ocurrencia, ctx.reloj.ahora(), anterior));
    tx.publicar(PUBLICADOS.OcurrenciaModificada, { eventoId: id, ocurrencia, accion: 'restaurada' });
  });
}

export function editarOcurrencia(ctx: ContextoDeCasoDeUso, id: string, ocurrencia: string, datos: DatosDeOcurrencia): Promise<EventoDeCalendario> {
  return ctx.almacen.escribir([EVENTOS], async (tx) => {
    const e = editarUna(await obtenerEvento(tx, id), ocurrencia, datos, ctx.reloj.ahora(), zonaDelUsuario());
    await tx.poner(EVENTOS, e);
    tx.publicar(PUBLICADOS.OcurrenciaModificada, { eventoId: id, ocurrencia, accion: 'editada' });
    return e;
  });
}

/** CA12: marca cumplida una ocurrencia de un bloque de compromiso. El RPG decide la XP (una vez por ocurrencia, con tope diario). */
export function marcarCumplido(ctx: ContextoDeCasoDeUso, id: string, ocurrencia: string): Promise<EventoDeCalendario> {
  return ctx.almacen.escribir([EVENTOS], async (tx) => {
    const zona = zonaDelUsuario();
    const e = marcarCumplida(await obtenerEvento(tx, id), ocurrencia, ctx.reloj.ahora(), zona);
    const o = instanciar(e, ocurrencia, zona)!;
    await tx.poner(EVENTOS, e);
    tx.publicar(PUBLICADOS.EventoMarcadoCumplido, {
      eventoId: id,
      ocurrencia,
      ocurrenciaId: `${id}|${ocurrencia}`,
      minutos: Math.round((o.finMs - o.inicioMs) / 60_000),
    });
    return e;
  });
}

/** Quita la marca (por error). No publica: la XP ya otorgada no se descuenta y no se vuelve a otorgar. */
export function desmarcarCumplido(ctx: ContextoDeCasoDeUso, id: string, ocurrencia: string): Promise<EventoDeCalendario> {
  return ctx.almacen.escribir([EVENTOS], async (tx) => {
    const e = desmarcarCumplida(await obtenerEvento(tx, id), ocurrencia, ctx.reloj.ahora());
    await tx.poner(EVENTOS, e);
    return e;
  });
}
