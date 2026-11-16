/**
 * Integración por consulta (ADR-0013/0015). Estudio ofrece, leyendo SOLO su almacén:
 * - la fuente de calendario `estudio.sesiones`: los focos completados, como bloques hechos;
 * - la ficha "Bloque de estudio" para reservar tiempo en el calendario.
 * El nombre de la materia o el trabajo se resuelve por consulta (sin importar Universidad).
 */
import type { ContextoDeModulo, Proveedores, ReferenciaDeEntidad } from '../../../nucleo/contrato';
import type { ElementoDeAgenda } from '../../../nucleo/dominio/agenda';
import type { Vinculo } from '../../../nucleo/dominio/fichas';
import type { SesionTerminada } from '../dominio/sesion';
import { cuenta } from '../dominio/estadisticas';
import { SESIONES } from './comun';
import { sesionesEntre } from './consultas';

export const ID_FUENTE = 'estudio.sesiones';
export const ID_FICHA = 'bloque-de-estudio';
export const DURACION_BLOQUE_MIN = 120;

const claveDe = (v: Vinculo) => `${v.tipo}|${v.id}`;

/** Nombres de los vínculos (si Universidad falla, se omiten: el título queda genérico). */
export async function resolverVinculos(ctx: Pick<ContextoDeModulo, 'integraciones'>, vinculos: readonly (Vinculo | null)[]): Promise<Map<string, ReferenciaDeEntidad>> {
  const porTipo = new Map<string, Set<string>>();
  for (const v of vinculos) if (v) porTipo.set(v.tipo, (porTipo.get(v.tipo) ?? new Set()).add(v.id));
  const resultados = await Promise.all(
    [...porTipo].map(([tipo, ids]) => ctx.integraciones.buscarReferencias({ tipo, ids: [...ids], incluirInactivas: true }).catch(() => ({ referencias: [] as ReferenciaDeEntidad[] }))),
  );
  return new Map(resultados.flatMap((r) => r.referencias).map((r) => [claveDe(r), r]));
}

export function elementoDeSesion(ctx: Pick<ContextoDeModulo, 't'>, s: SesionTerminada, ref: ReferenciaDeEntidad | undefined): ElementoDeAgenda {
  return {
    id: s.id,
    titulo: ref ? ctx.t('estudio.calendario.conVinculo', { nombre: ref.titulo }) : ctx.t('estudio.calendario.titulo'),
    inicio: s.iniciadaEn,
    fin: s.finalizadaEn,
    tipo: 'bloque',
    estado: 'hecho',
    color: ref?.color ?? 'morado',
    ruta: '/estudio',
  };
}

export function crearProveedores(ctx: ContextoDeModulo): Proveedores {
  return {
    fuentesDeCalendario: [
      {
        id: ID_FUENTE,
        nombre: 'estudio.fuenteCalendario',
        async elementos(rango) {
          const sesiones = (await ctx.almacen.leer([SESIONES], (tx) => sesionesEntre(tx, rango.desde, rango.hasta))).filter(cuenta);
          const refs = await resolverVinculos(ctx, sesiones.map((s) => s.vinculo));
          return sesiones.map((s) => elementoDeSesion(ctx, s, s.vinculo ? refs.get(claveDe(s.vinculo)) : undefined));
        },
        alCambiar: (escucha) => ctx.almacen.alCambiar([SESIONES], escucha),
      },
    ],
    fichas: {
      nombre: 'estudio.fichas',
      fichas: async () => [{ id: ID_FICHA, titulo: ctx.t('estudio.ficha.titulo'), detalle: ctx.t('estudio.ficha.detalle'), color: 'morado', duracionMin: DURACION_BLOQUE_MIN, repeticion: { tipo: 'unica' } }],
    },
  };
}
