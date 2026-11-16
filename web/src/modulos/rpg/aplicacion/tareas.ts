/**
 * Mientras Ludus está abierto (alIniciar):
 * - Al abrir y al volver a primer plano: si hay semanas cerradas sin evaluar, publica
 *   rpg.SemanasCerradas para que la suscripción se ponga al día EN ORDEN con el resto
 *   del registro (sin temporizadores ni evaluaciones fuera de la transacción).
 * - Muestra los avisos pendientes de nivel, atributo y logro, agrupados en uno (R5).
 */
import type { AvisoDelShell, ContextoDeModulo } from '../../../nucleo/contrato';
import { crearZona } from '../../../nucleo/dominio/zona-horaria';
import { ZONA_HORARIA } from '../../../nucleo/i18n/traductor';
import { finDeSemanaMs, lunesAnterior, lunesDe, siguienteLunes } from '../dominio/racha';
import { REGLAS_DEL_RPG } from '../dominio/configuracion-activa';
import { ALMACEN_AVISOS, ALMACEN_PERFIL, EVENTOS, perfilDesdeAlmacen, type AvisoPendiente, type Perfil } from './almacenes';

const zona = crearZona(ZONA_HORARIA);

export async function pedirCierreDeSemanas(ctx: Pick<ContextoDeModulo, 'almacen' | 'reloj'>): Promise<boolean> {
  return ctx.almacen.escribir([ALMACEN_PERFIL], async (tx) => {
    const ahora = ctx.reloj.ahora();
    const p = perfilDesdeAlmacen(await tx.obtener<Perfil>(ALMACEN_PERFIL, 'perfil'), REGLAS_DEL_RPG, ahora.toISOString());
    if (!p.racha.primerLunes) return false;
    const siguiente = p.racha.ultimoLunesEvaluado ? siguienteLunes(p.racha.ultimoLunesEvaluado) : p.racha.primerLunes;
    if (finDeSemanaMs(siguiente, zona) > ahora.getTime()) return false;
    tx.publicar(EVENTOS.SemanasCerradas, { hasta: lunesAnterior(lunesDe(zona.aCivil(ahora.getTime()).fecha)) });
    return true;
  });
}

/** Agrupa niveles, atributos y logros en un solo aviso. */
export function avisoAgrupado(t: ContextoDeModulo['t'], pendientes: readonly AvisoPendiente[]): AvisoDelShell | null {
  if (pendientes.length === 0) return null;
  const niveles = pendientes.filter((a) => a.tipo === 'nivel').map((a) => a.nivel);
  const logros = pendientes.filter((a) => a.tipo === 'logro').map((a) => t(`rpg.logro.${a.logroId}`));
  const atributos = pendientes.filter((a) => a.tipo === 'atributo');
  const lista = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} ${t('rpg.y')} ${xs[xs.length - 1]}`);
  const partes: string[] = [];
  if (logros.length === 1) partes.push(t('rpg.aviso.logro', { nombre: logros[0]! }));
  if (logros.length > 1) partes.push(t('rpg.aviso.logros', { n: logros.length, nombres: lista(logros) }));
  const ultimos = new Map(atributos.map((a) => [a.atributo, a.nivel]));
  for (const [a, n] of ultimos) partes.push(t('rpg.aviso.atributo', { atributo: t(`rpg.atributo.${a}`), nivel: n }));
  if (niveles.length > 0) return { icono: '⭐', titulo: t('rpg.aviso.nivel', { nivel: Math.max(...niveles) }), detalle: partes.join(' · ') || undefined };
  if (logros.length > 0) return { icono: '🏅', titulo: partes[0]!, detalle: partes.slice(1).join(' · ') || undefined };
  return { icono: '📈', titulo: partes.join(' · ') };
}

export function iniciarTareasDelRpg(ctx: ContextoDeModulo): () => void {
  let detenido = false;
  const visible = () => typeof document === 'undefined' || document.visibilityState === 'visible';

  const mostrarAvisos = async () => {
    if (detenido || !visible()) return;
    try {
      const pendientes = await ctx.almacen.escribir([ALMACEN_AVISOS], async (tx) => {
        const lista = (await tx.listar<AvisoPendiente>(ALMACEN_AVISOS)).filter((a) => !a.mostradoEn);
        const ahora = ctx.reloj.ahora().toISOString();
        for (const a of lista) await tx.poner(ALMACEN_AVISOS, { ...a, mostradoEn: ahora });
        return lista;
      });
      const aviso = avisoAgrupado(ctx.t, pendientes);
      if (aviso) ctx.avisos.mostrar(aviso);
    } catch (error) {
      ctx.diagnostico.registrar('error', 'rpg', 'No se pudieron mostrar los avisos', error);
    }
  };
  const revisar = async () => {
    if (detenido) return;
    try {
      await pedirCierreDeSemanas(ctx);
    } catch (error) {
      ctx.diagnostico.registrar('error', 'rpg', 'No se pudo revisar la racha', error);
    }
    await mostrarAvisos();
  };
  const alVolver = () => visible() && void revisar();

  const dejar = ctx.almacen.alCambiar([ALMACEN_AVISOS], () => void mostrarAvisos());
  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', alVolver);
  void revisar();
  return () => {
    detenido = true;
    dejar();
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', alVolver);
  };
}
