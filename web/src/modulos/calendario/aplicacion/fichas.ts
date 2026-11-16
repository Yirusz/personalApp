/**
 * Fichas (H8, ADR-0015): CRUD de fichas propias, proveedor para el núcleo y
 * "poner" una ficha en el calendario. Quitar = eliminar el evento que creó
 * (`eliminarEvento`, con deshacer en la UI).
 */
import type { ContextoDeModulo, Proveedores, TransaccionDeLectura } from '../../../nucleo/contrato';
import type { FichaDeCalendario } from '../../../nucleo/dominio/fichas';
import { FichaNoEncontrada } from '../dominio/errores';
import type { EventoDeCalendario } from '../dominio/evento';
import { claveDeFicha, comoFicha, crearFichaPropia, editarFichaPropia, eventoDesdeFicha, type DatosDeFichaPropia, type FichaPropia } from '../dominio/ficha';
import { FICHAS, PUBLICADOS, zonaDelUsuario, type ContextoDeCasoDeUso } from './comun';
import { crearEvento } from './eventos';

export const MODULO = 'calendario';

export async function leerFichasPropias(tx: TransaccionDeLectura): Promise<FichaPropia[]> {
  const todas = await tx.listar<FichaPropia>(FICHAS);
  return todas.sort((a, b) => a.titulo.localeCompare(b.titulo, 'es-CO'));
}

async function obtenerFicha(tx: TransaccionDeLectura, id: string): Promise<FichaPropia> {
  const f = await tx.obtener<FichaPropia>(FICHAS, id);
  if (!f) throw new FichaNoEncontrada(`No existe la ficha ${id}`);
  return f;
}

export function crearFicha(ctx: ContextoDeCasoDeUso, datos: DatosDeFichaPropia): Promise<FichaPropia> {
  return ctx.almacen.escribir([FICHAS], async (tx) => {
    const f = crearFichaPropia({ ...datos, id: ctx.nuevoId() }, ctx.reloj.ahora());
    await tx.poner(FICHAS, f);
    tx.publicar(PUBLICADOS.FichaCreada, { fichaId: f.id });
    return f;
  });
}

export function editarFicha(ctx: ContextoDeCasoDeUso, id: string, datos: DatosDeFichaPropia): Promise<FichaPropia> {
  return ctx.almacen.escribir([FICHAS], async (tx) => {
    const f = editarFichaPropia(await obtenerFicha(tx, id), datos, ctx.reloj.ahora());
    await tx.poner(FICHAS, f);
    tx.publicar(PUBLICADOS.FichaEditada, { fichaId: id });
    return f;
  });
}

/** Los eventos que ya creó la ficha se conservan. Si no existe, no hace nada (deshacer diferido). */
export function eliminarFicha(ctx: ContextoDeCasoDeUso, id: string): Promise<void> {
  return ctx.almacen.escribir([FICHAS], async (tx) => {
    if (!(await tx.obtener(FICHAS, id))) return;
    await tx.borrar(FICHAS, id);
    tx.publicar(PUBLICADOS.FichaEliminada, { fichaId: id });
  });
}

/** Pone una ficha (de cualquier módulo) empezando en `inicioMs`. */
export function colocarFicha(ctx: ContextoDeCasoDeUso, modulo: string, ficha: FichaDeCalendario, inicioMs: number): Promise<EventoDeCalendario> {
  return crearEvento(ctx, eventoDesdeFicha(ficha, claveDeFicha(modulo, ficha.id), inicioMs, zonaDelUsuario()));
}

/** El Calendario ofrece sus fichas propias por el mismo canal que los demás módulos. */
export function crearProveedoresDelCalendario(ctx: Pick<ContextoDeModulo, 'almacen'>): Proveedores {
  return {
    fichas: {
      nombre: 'calendario.fichasPropias',
      fichas: () => ctx.almacen.leer([FICHAS], async (tx) => (await leerFichasPropias(tx)).map(comoFicha)),
      alCambiar: (escucha) => ctx.almacen.alCambiar([FICHAS], escucha),
    },
  };
}
