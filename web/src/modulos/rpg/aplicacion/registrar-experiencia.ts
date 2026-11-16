/**
 * Núcleo del RPG: escucha TODOS los eventos y, en la misma transacción que avanza su cursor:
 * 1. Pone al día la racha: evalúa, en orden, las semanas que cerraron antes de que se
 *    publicara el evento (R2; sin temporizadores, determinista con el registro).
 * 2. Si hay regla para el tipo: calcula la XP (tramos, racha vigente en la semana del
 *    evento, tope), escribe el asiento y actualiza los contadores del día (R1).
 * 3. Suma los contadores de logros y desbloquea los que se cumplan (R3).
 * 4. Actualiza perfil, nivel y niveles de atributo (R6) y deja avisos pendientes (R5).
 * Los demás módulos no saben que esto existe. Idempotente: el asiento usa el id del evento.
 */
import type { Suscripcion, Transaccion, TransaccionDeLectura } from '../../../nucleo/contrato';
import type { EventoDeDominio } from '../../../nucleo/dominio/evento';
import { marcaDeTiempoDe } from '../../../nucleo/dominio/uuidv7';
import type { Zona } from '../../../nucleo/dominio/zona-horaria';
import { claveDeContador, logrosCumplidos, sumarContadores, type EstadoParaLogros } from '../dominio/logros';
import { progresoPara } from '../dominio/nivel';
import { diasDeLaSemana, evaluarSemana, finDeSemanaMs, lunesAnterior, lunesDe, semanaIso, semanasCerradas, siguienteLunes } from '../dominio/racha';
import { calcularXp, claveUnica, indexarReglas, type ConfiguracionDeReglas, type Logro } from '../dominio/reglas';
import {
  ALMACEN_AVISOS,
  ALMACEN_CONTADORES,
  ALMACEN_DIAS,
  ALMACEN_LOGROS,
  ALMACEN_PERFIL,
  ALMACEN_REGISTRO,
  ALMACEN_SEMANAS,
  diaVacio,
  EVENTOS,
  INDICE_CLAVE_UNICA,
  perfilDesdeAlmacen,
  type AsientoDeExperiencia,
  type AvisoPendiente,
  type DiaDeActividad,
  type LogroGuardado,
  type Perfil,
  type SemanaEvaluada,
} from './almacenes';

export * from './almacenes';

/** Versión de los contadores construidos a partir del libro (para el relleno inicial). */
export const VERSION_DE_CONTADORES = 1;
/** Notas que indican que el evento no debe contar como actividad (farmeo). */
const NO_CUENTAN_COMO_ACTIVIDAD = new Set(['muy-rapido', 'ya-otorgado']);

const ALMACENES = [ALMACEN_REGISTRO, ALMACEN_PERFIL, ALMACEN_DIAS, ALMACEN_SEMANAS, ALMACEN_CONTADORES, ALMACEN_LOGROS, ALMACEN_AVISOS];

/** Hora de publicación del evento (los ids son UUIDv7); si no lo es, su ocurridoEn. */
function publicadoEn(evento: Pick<EventoDeDominio, 'id' | 'ocurridoEn'>): number {
  try {
    return marcaDeTiempoDe(evento.id);
  } catch {
    return Date.parse(evento.ocurridoEn);
  }
}

interface Contexto {
  tx: Transaccion;
  cfg: ConfiguracionDeReglas;
  zona: Zona;
  perfil: Perfil;
  /** Días tocados en esta transacción (se guardan al final). */
  dias: Map<string, DiaDeActividad>;
}

const diaLocal = (zona: Zona, instante: string) => zona.aCivil(Date.parse(instante)).fecha;

async function dia(c: Contexto, fecha: string): Promise<DiaDeActividad> {
  let d = c.dias.get(fecha);
  if (!d) {
    d = (await c.tx.obtener<DiaDeActividad>(ALMACEN_DIAS, fecha)) ?? diaVacio(fecha);
    c.dias.set(fecha, d);
  }
  return d;
}

/** ¿Cuenta este evento como día activo para la racha? Solo si se registró antes de que cerrara su semana (sin gracia). */
function cuentaParaRacha(c: Contexto, tipo: string, nota: string | undefined, fecha: string, publicadoMs: number): boolean {
  return c.cfg.racha.eventosQueCuentan.includes(tipo) && !NO_CUENTAN_COMO_ACTIVIDAD.has(nota ?? '') && publicadoMs < finDeSemanaMs(lunesDe(fecha), c.zona);
}

async function totales(tx: TransaccionDeLectura, cfg: ConfiguracionDeReglas): Promise<Record<string, number>> {
  const valores = await Promise.all(cfg.contadores.map((k) => tx.obtener<{ clave: string; n: number }>(ALMACEN_CONTADORES, `total|${k.id}`)));
  return Object.fromEntries(cfg.contadores.map((k, i) => [k.id, valores[i]?.n ?? 0]));
}

async function avisar(c: Contexto, aviso: AvisoPendiente): Promise<void> {
  if (!(await c.tx.obtener(ALMACEN_AVISOS, aviso.id))) await c.tx.poner(ALMACEN_AVISOS, aviso);
}

/** Desbloquea los logros que se cumplen (idempotente) y publica cada uno. */
async function revisarLogros(c: Contexto, delDia: Record<string, number>, ocurridoEn: string): Promise<Logro[]> {
  const guardados = await c.tx.listar<LogroGuardado>(ALMACEN_LOGROS);
  const estado: EstadoParaLogros = { totales: await totales(c.tx, c.cfg), delDia, semanasDeRacha: c.perfil.racha.semanas };
  const nuevos = logrosCumplidos(c.cfg.logros, estado, new Set(guardados.map((l) => l.id)));
  for (const l of nuevos) {
    await c.tx.poner(ALMACEN_LOGROS, { id: l.id, desbloqueadoEn: ocurridoEn } satisfies LogroGuardado);
    c.tx.publicar(EVENTOS.LogroDesbloqueado, { logroId: l.id, xp: l.xp }, { ocurridoEn });
    await avisar(c, { id: `logro|${l.id}`, tipo: 'logro', logroId: l.id, creadoEn: ocurridoEn });
  }
  return nuevos;
}

/** R2: evalúa en orden las semanas que ya cerraron en `hastaMs`. */
async function ponerAlDia(c: Contexto, hastaMs: number): Promise<void> {
  const r = c.perfil.racha;
  if (!r.primerLunes) return;
  const desde = r.ultimoLunesEvaluado ? siguienteLunes(r.ultimoLunesEvaluado) : r.primerLunes;
  for (const lunes of semanasCerradas(desde, hastaMs, c.zona)) {
    const semana = semanaIso(lunes);
    const activos = (await Promise.all(diasDeLaSemana(lunes).map((f) => dia(c, f)))).filter((d) => d.activo).length;
    const rachaAntes = c.perfil.racha.semanas;
    const { estado, resultado, comodinGanado } = evaluarSemana(c.perfil.racha, activos, c.cfg.racha);
    await c.tx.poner(ALMACEN_SEMANAS, { lunes, semana, diasActivos: activos, resultado, rachaAntes, despues: estado, comodinGanado } satisfies SemanaEvaluada);
    c.perfil.racha = { ...estado, primerLunes: r.primerLunes, ultimoLunesEvaluado: lunes };
    // Los hechos de la racha ocurrieron al cerrar la semana (último instante del domingo).
    const ocurridoEn = new Date(finDeSemanaMs(lunes, c.zona) - 1).toISOString();
    if (resultado === 'cumplida') c.tx.publicar(EVENTOS.SemanaDeRachaCumplida, { semana, racha: estado.semanas }, { ocurridoEn });
    if (comodinGanado) c.tx.publicar(EVENTOS.ComodinGanado, { semana, comodines: estado.comodines }, { ocurridoEn });
    if (resultado === 'comodin') c.tx.publicar(EVENTOS.ComodinUsado, { semana, comodines: estado.comodines }, { ocurridoEn });
    if (resultado === 'perdida') c.tx.publicar(EVENTOS.RachaPerdida, { semana, semanasAntes: rachaAntes }, { ocurridoEn });
    if (resultado === 'cumplida') await revisarLogros(c, {}, ocurridoEn);
  }
}

/** Racha que regía en la semana del evento: la que quedó al evaluar la semana anterior. */
async function rachaVigente(c: Contexto, fecha: string): Promise<number> {
  const previa = await c.tx.obtener<SemanaEvaluada>(ALMACEN_SEMANAS, lunesAnterior(lunesDe(fecha)));
  return previa?.despues.semanas ?? 0;
}

/**
 * Relleno inicial (una vez): construye los contadores por día y los totales a partir del
 * libro existente. Los contadores con filtro por datos (`donde`) empiezan en 0: el libro
 * no guarda los datos de los eventos.
 */
async function asegurarContadores(c: Contexto, ahora: string): Promise<void> {
  if (c.perfil.contadores === VERSION_DE_CONTADORES) return;
  const asientos = await c.tx.listar<AsientoDeExperiencia>(ALMACEN_REGISTRO);
  const sumables = c.cfg.contadores.filter((k) => !k.donde && !k.unaVezPor);
  const total: Record<string, number> = {};
  for (const a of asientos) {
    if (a.oro !== undefined) continue;
    const d = await dia(c, a.dia);
    const t = (d.porTipo[a.tipo] ??= { cantidad: 0, xp: 0 });
    t.cantidad++;
    t.xp += a.xp;
    if (cuentaParaRacha(c, a.tipo, a.nota, a.dia, publicadoEn({ id: a.id, ocurridoEn: a.ocurridoEn }))) d.activo = true;
    for (const k of sumables.filter((k) => k.evento === a.tipo)) {
      d.porContador[k.id] = (d.porContador[k.id] ?? 0) + 1;
      total[k.id] = (total[k.id] ?? 0) + 1;
    }
  }
  for (const [id, n] of Object.entries(total)) await c.tx.poner(ALMACEN_CONTADORES, { clave: `total|${id}`, n });
  const primero = asientos.map((a) => a.dia).sort()[0];
  if (primero && !c.perfil.racha.primerLunes) c.perfil.racha.primerLunes = lunesDe(primero);
  c.perfil.contadores = VERSION_DE_CONTADORES;
  // Lo que el historial ya cumple se desbloquea ahora (R5 lo muestra en un solo aviso).
  for (const d of c.dias.values()) await revisarLogros(c, d.porContador, ahora);
  await revisarLogros(c, {}, ahora);
}

export function crearSuscripcionDeExperiencia(cfg: ConfiguracionDeReglas, zona: Zona): Suscripcion {
  const reglas = indexarReglas(cfg);
  return {
    id: 'rpg.experiencia',
    tipos: '*',
    almacenes: ALMACENES,
    async manejar(evento: EventoDeDominio, tx) {
      if (await tx.obtener(ALMACEN_REGISTRO, evento.id)) return;
      const fecha = diaLocal(zona, evento.ocurridoEn);
      const c: Contexto = { tx, cfg, zona, perfil: perfilDesdeAlmacen(await tx.obtener<Perfil>(ALMACEN_PERFIL, 'perfil'), cfg, evento.ocurridoEn), dias: new Map() };
      const publicadoMs = publicadoEn(evento);
      await asegurarContadores(c, evento.ocurridoEn);
      c.perfil.racha.primerLunes ??= lunesDe(fecha);
      await ponerAlDia(c, publicadoMs);

      const regla = reglas.get(evento.tipo);
      const d = await dia(c, fecha);
      if (regla) {
        const clave = claveUnica(regla, evento.datos);
        let yaOtorgado = false;
        if (clave !== undefined) {
          const previos = await tx.listar<AsientoDeExperiencia>(ALMACEN_REGISTRO, { indice: INDICE_CLAVE_UNICA, desde: clave, hasta: clave });
          yaOtorgado = previos.some((a) => a.xp > 0);
        }
        const delTipo = d.porTipo[evento.tipo] ?? { cantidad: 0, xp: 0 };
        const { xpBase, xp, nota } = calcularXp(regla, evento.datos, {
          acumuladoHoy: delTipo.xp,
          cantidadHoy: delTipo.cantidad,
          yaOtorgado,
          semanasDeRacha: await rachaVigente(c, fecha),
          racha: cfg.racha,
        });
        await tx.poner(ALMACEN_REGISTRO, {
          id: evento.id,
          tipo: evento.tipo,
          dia: fecha,
          ocurridoEn: evento.ocurridoEn,
          xpBase,
          xp,
          atributo: regla.atributo,
          ...(nota ? { nota } : {}),
          ...(clave !== undefined ? { claveUnica: clave } : {}),
        } satisfies AsientoDeExperiencia);
        d.porTipo[evento.tipo] = { cantidad: delTipo.cantidad + 1, xp: delTipo.xp + xp };
        if (cuentaParaRacha(c, evento.tipo, nota, fecha, publicadoMs)) d.activo = true;

        if (xp > 0) {
          const p = c.perfil;
          const nivelAnterior = p.nivel;
          p.xpTotal += xp;
          p.atributos[regla.atributo] = (p.atributos[regla.atributo] ?? 0) + xp;
          p.nivel = progresoPara(p.xpTotal, cfg.nivel).nivel;
          if (p.nivel > nivelAnterior) {
            tx.publicar(EVENTOS.NivelAlcanzado, { nivel: p.nivel, nivelAnterior });
            await avisar(c, { id: `nivel|${p.nivel}`, tipo: 'nivel', nivel: p.nivel, creadoEn: evento.ocurridoEn });
          }
          const nivelAtributo = progresoPara(p.atributos[regla.atributo]!, cfg.nivelDeAtributo).nivel;
          if (nivelAtributo > (p.nivelesDeAtributo[regla.atributo] ?? 1)) {
            p.nivelesDeAtributo[regla.atributo] = nivelAtributo;
            tx.publicar(EVENTOS.NivelDeAtributoAlcanzado, { atributo: regla.atributo, nivel: nivelAtributo });
            await avisar(c, { id: `atributo|${regla.atributo}|${nivelAtributo}`, tipo: 'atributo', atributo: regla.atributo, nivel: nivelAtributo, creadoEn: evento.ocurridoEn });
          }
        }
      }

      // R3: contadores de logros (total y del día), una vez por entidad si se pide.
      const sumados = [];
      for (const id of sumarContadores(cfg.contadores, evento.tipo, evento.datos, () => false)) {
        const k = cfg.contadores.find((x) => x.id === id)!;
        const claveEntidad = claveDeContador(k, evento.datos);
        if (claveEntidad !== undefined) {
          if (await tx.obtener(ALMACEN_CONTADORES, claveEntidad)) continue;
          await tx.poner(ALMACEN_CONTADORES, { clave: claveEntidad, n: 1 });
        }
        const total = (await tx.obtener<{ clave: string; n: number }>(ALMACEN_CONTADORES, `total|${id}`))?.n ?? 0;
        await tx.poner(ALMACEN_CONTADORES, { clave: `total|${id}`, n: total + 1 });
        d.porContador[id] = (d.porContador[id] ?? 0) + 1;
        sumados.push(id);
      }
      if (sumados.length > 0) await revisarLogros(c, d.porContador, evento.ocurridoEn);

      c.perfil.actualizadoEn = evento.ocurridoEn;
      for (const x of c.dias.values()) await tx.poner(ALMACEN_DIAS, x);
      await tx.poner(ALMACEN_PERFIL, c.perfil);
    },
  };
}

export function leerPerfil(tx: TransaccionDeLectura): Promise<Perfil | undefined> {
  return tx.obtener<Perfil>(ALMACEN_PERFIL, 'perfil');
}

export function leerUltimosAsientos(tx: TransaccionDeLectura, limite = 20): Promise<AsientoDeExperiencia[]> {
  return tx.listar<AsientoDeExperiencia>(ALMACEN_REGISTRO, { inverso: true, limite });
}
