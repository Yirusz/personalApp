/**
 * Núcleo del RPG: escucha TODOS los eventos y, si hay una regla para su tipo,
 * registra un asiento de experiencia y actualiza el perfil. Los demás módulos
 * no saben que esto existe.
 *
 * Idempotente: el asiento usa el id del evento como clave.
 */
import type { Suscripcion, TransaccionDeLectura } from '../../../nucleo/contrato';
import type { EventoDeDominio } from '../../../nucleo/dominio/evento';
import { progresoPara } from '../dominio/nivel';
import { aplicarLimiteDiario, indexarReglas, xpBase, type ConfiguracionDeReglas } from '../dominio/reglas';

export const ALMACEN_REGISTRO = 'registro';
export const ALMACEN_PERFIL = 'perfil';
export const INDICE_TIPO_DIA = 'por_tipo_dia';
export const EVENTO_NIVEL_ALCANZADO = 'rpg.NivelAlcanzado';
const ID_PERFIL = 'perfil';

/** Un movimiento del "libro de experiencia". */
export interface AsientoDeExperiencia {
  /** = id del evento que lo originó. */
  id: string;
  tipo: string;
  /** Día local (America/Bogota), AAAA-MM-DD. */
  dia: string;
  ocurridoEn: string;
  xpBase: number;
  xp: number;
  atributo: string;
  /** Por qué se otorgó menos de la base, si aplica. */
  nota?: 'limite-diario';
}

export interface Perfil {
  id: typeof ID_PERFIL;
  xpTotal: number;
  oroGastado: number;
  atributos: Record<string, number>;
  nivel: number;
  actualizadoEn: string;
}

export function perfilInicial(atributos: readonly string[], instante: string): Perfil {
  return {
    id: ID_PERFIL,
    xpTotal: 0,
    oroGastado: 0,
    atributos: Object.fromEntries(atributos.map((a) => [a, 0])),
    nivel: 1,
    actualizadoEn: instante,
  };
}

export function oroDisponible(perfil: Perfil, cfg: ConfiguracionDeReglas): number {
  return Math.floor(perfil.xpTotal / cfg.oro.xpPorOro) - perfil.oroGastado;
}

export function crearSuscripcionDeExperiencia(
  cfg: ConfiguracionDeReglas,
  diaLocal: (instante: string) => string,
): Suscripcion {
  const reglas = indexarReglas(cfg);
  return {
    id: 'rpg.experiencia',
    tipos: '*',
    almacenes: [ALMACEN_REGISTRO, ALMACEN_PERFIL],
    async manejar(evento: EventoDeDominio, tx) {
      const regla = reglas.get(evento.tipo);
      if (!regla) return;
      if (await tx.obtener(ALMACEN_REGISTRO, evento.id)) return;

      const dia = diaLocal(evento.ocurridoEn);
      const base = xpBase(regla, evento.datos);
      let xp = base;
      if (regla.limiteDiarioXp !== undefined) {
        const delDia = await tx.listar<AsientoDeExperiencia>(ALMACEN_REGISTRO, {
          indice: INDICE_TIPO_DIA,
          desde: [evento.tipo, dia],
          hasta: [evento.tipo, dia],
        });
        xp = aplicarLimiteDiario(base, delDia.reduce((suma, a) => suma + a.xp, 0), regla.limiteDiarioXp);
      }

      const asiento: AsientoDeExperiencia = {
        id: evento.id,
        tipo: evento.tipo,
        dia,
        ocurridoEn: evento.ocurridoEn,
        xpBase: base,
        xp,
        atributo: regla.atributo,
        ...(xp < base ? { nota: 'limite-diario' as const } : {}),
      };
      await tx.poner(ALMACEN_REGISTRO, asiento);
      if (xp === 0) return;

      const perfil = (await tx.obtener<Perfil>(ALMACEN_PERFIL, ID_PERFIL)) ?? perfilInicial(cfg.atributos, evento.ocurridoEn);
      const nivelAnterior = perfil.nivel;
      perfil.xpTotal += xp;
      perfil.atributos[regla.atributo] = (perfil.atributos[regla.atributo] ?? 0) + xp;
      perfil.nivel = progresoPara(perfil.xpTotal, cfg.nivel).nivel;
      perfil.actualizadoEn = evento.ocurridoEn;
      await tx.poner(ALMACEN_PERFIL, perfil);

      if (perfil.nivel > nivelAnterior) tx.publicar(EVENTO_NIVEL_ALCANZADO, { nivel: perfil.nivel, nivelAnterior });
    },
  };
}

export function leerPerfil(tx: TransaccionDeLectura): Promise<Perfil | undefined> {
  return tx.obtener<Perfil>(ALMACEN_PERFIL, ID_PERFIL);
}

export function leerUltimosAsientos(tx: TransaccionDeLectura, limite = 20): Promise<AsientoDeExperiencia[]> {
  return tx.listar<AsientoDeExperiencia>(ALMACEN_REGISTRO, { inverso: true, limite });
}
