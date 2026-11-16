/**
 * R4: recompensas propias y canje. El canje es un asiento de oro gastado en el libro
 * (oro = ⌊XP / 10⌋ − gastado) y nunca deja el oro en negativo. Deshacer = anular el
 * canje con un asiento que devuelve el oro (el libro nunca se borra).
 */
import type { ContextoDeModulo } from '../../../nucleo/contrato';
import { costoDeRecompensa, ErrorDeRecompensa, nombreDeRecompensa } from '../dominio/recompensa';
import { REGLAS_DEL_RPG } from '../dominio/configuracion-activa';
import { ALMACEN_PERFIL, ALMACEN_RECOMPENSAS, ALMACEN_REGISTRO, EVENTOS, oroDisponible, perfilDesdeAlmacen, type AsientoDeExperiencia, type Perfil, type Recompensa } from './almacenes';

type Ctx = Pick<ContextoDeModulo, 'almacen' | 'reloj' | 'nuevoId' | 'formatos'>;

export function crearRecompensa(ctx: Ctx, d: { nombre: string; costo: number }): Promise<Recompensa> {
  return ctx.almacen.escribir([ALMACEN_RECOMPENSAS], async (tx) => {
    const ahora = ctx.reloj.ahora().toISOString();
    const r: Recompensa = { id: ctx.nuevoId(), nombre: nombreDeRecompensa(d.nombre), costo: costoDeRecompensa(d.costo), archivada: false, creadaEn: ahora, actualizadaEn: ahora };
    await tx.poner(ALMACEN_RECOMPENSAS, r);
    return r;
  });
}

async function cambiar(ctx: Ctx, id: string, fn: (r: Recompensa) => Recompensa): Promise<Recompensa> {
  return ctx.almacen.escribir([ALMACEN_RECOMPENSAS], async (tx) => {
    const r = await tx.obtener<Recompensa>(ALMACEN_RECOMPENSAS, id);
    if (!r) throw new ErrorDeRecompensa('rpg.error.recompensaNoExiste');
    const nueva = { ...fn(r), actualizadaEn: ctx.reloj.ahora().toISOString() };
    await tx.poner(ALMACEN_RECOMPENSAS, nueva);
    return nueva;
  });
}

export const editarRecompensa = (ctx: Ctx, id: string, d: { nombre: string; costo: number }) => cambiar(ctx, id, (r) => ({ ...r, nombre: nombreDeRecompensa(d.nombre), costo: costoDeRecompensa(d.costo) }));
export const archivarRecompensa = (ctx: Ctx, id: string) => cambiar(ctx, id, (r) => ({ ...r, archivada: true }));
export const restaurarRecompensa = (ctx: Ctx, id: string) => cambiar(ctx, id, (r) => ({ ...r, archivada: false }));

const ALMACENES_DE_CANJE = [ALMACEN_PERFIL, ALMACEN_RECOMPENSAS, ALMACEN_REGISTRO];

/** Canjea: verifica el oro, escribe el asiento y publica rpg.RecompensaCanjeada. Devuelve el id del canje. */
export function canjear(ctx: Ctx, recompensaId: string): Promise<string> {
  return ctx.almacen.escribir(ALMACENES_DE_CANJE, async (tx) => {
    const r = await tx.obtener<Recompensa>(ALMACEN_RECOMPENSAS, recompensaId);
    if (!r || r.archivada) throw new ErrorDeRecompensa('rpg.error.recompensaNoExiste');
    const ahora = ctx.reloj.ahora().toISOString();
    const perfil = perfilDesdeAlmacen(await tx.obtener<Perfil>(ALMACEN_PERFIL, 'perfil'), REGLAS_DEL_RPG, ahora);
    const disponible = oroDisponible(perfil, REGLAS_DEL_RPG);
    if (r.costo > disponible) throw new ErrorDeRecompensa('rpg.error.oroInsuficiente', undefined, { falta: r.costo - disponible });
    const evento = tx.publicar(EVENTOS.RecompensaCanjeada, { recompensaId: r.id, nombre: r.nombre, costo: r.costo });
    await tx.poner(ALMACEN_REGISTRO, { id: evento.id, tipo: evento.tipo, dia: ctx.formatos.diaLocal(ahora), ocurridoEn: ahora, xpBase: 0, xp: 0, atributo: '', oro: r.costo } satisfies AsientoDeExperiencia);
    await tx.poner(ALMACEN_PERFIL, { ...perfil, oroGastado: perfil.oroGastado + r.costo, actualizadoEn: ahora });
    return evento.id;
  });
}

/** Deshacer un canje: asiento que devuelve el oro. Si ya estaba anulado, no hace nada. */
export function anularCanje(ctx: Ctx, canjeId: string): Promise<void> {
  return ctx.almacen.escribir(ALMACENES_DE_CANJE, async (tx) => {
    const canje = await tx.obtener<AsientoDeExperiencia>(ALMACEN_REGISTRO, canjeId);
    if (!canje || canje.oro === undefined || canje.oro <= 0 || canje.anulado) return;
    const ahora = ctx.reloj.ahora().toISOString();
    const perfil = perfilDesdeAlmacen(await tx.obtener<Perfil>(ALMACEN_PERFIL, 'perfil'), REGLAS_DEL_RPG, ahora);
    const evento = tx.publicar(EVENTOS.CanjeAnulado, { canjeId, costo: canje.oro });
    await tx.poner(ALMACEN_REGISTRO, { ...canje, anulado: true });
    await tx.poner(ALMACEN_REGISTRO, { id: evento.id, tipo: evento.tipo, dia: ctx.formatos.diaLocal(ahora), ocurridoEn: ahora, xpBase: 0, xp: 0, atributo: '', oro: -canje.oro } satisfies AsientoDeExperiencia);
    await tx.poner(ALMACEN_PERFIL, { ...perfil, oroGastado: Math.max(0, perfil.oroGastado - canje.oro), actualizadoEn: ahora });
  });
}
