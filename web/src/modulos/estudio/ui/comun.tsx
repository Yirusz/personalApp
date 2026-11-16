/** Piezas de UI compartidas por las pantallas de Estudio. */
import { useEffect, useState } from 'preact/hooks';
import type { ContextoDeModulo, ReferenciaDeEntidad } from '../../../nucleo/contrato';
import type { Vinculo } from '../../../nucleo/dominio/fichas';
import type { Traductor } from '../../../nucleo/i18n/traductor';
import { ErrorDeEstudio } from '../dominio/errores';
import './estudio.css';

export const TIPOS_VINCULABLES = ['universidad.materia', 'universidad.trabajo'] as const;

export function mensajeDeError(t: Traductor, error: unknown): string {
  return error instanceof ErrorDeEstudio ? t(error.clave, error.parametros) : t('estudio.error.inesperado');
}

/** "2 h 30 min", "45 min", "1 hora". */
export function textoDeMinutos(t: Traductor, minutos: number): string {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  if (h === 0) return t('estudio.minutos', { n: m });
  return m === 0 ? t('estudio.horas', { n: h }) : t('estudio.horasMinutos', { h, m });
}

export const claveDeVinculo = (v: Vinculo) => `${v.tipo}|${v.id}`;
export function vinculoDeClave(k: string): Vinculo | null {
  const i = k.indexOf('|');
  return i > 0 ? { tipo: k.slice(0, i), id: k.slice(i + 1) } : null;
}

/** Re-renderiza cada `ms` mientras `activo` (solo repinta: el tiempo sale del Reloj). */
export function useTic(ctx: ContextoDeModulo, activo: boolean, ms = 1000): number {
  const [ahora, setAhora] = useState(() => ctx.reloj.ahora().getTime());
  useEffect(() => {
    setAhora(ctx.reloj.ahora().getTime());
    if (!activo) return;
    const id = setInterval(() => setAhora(ctx.reloj.ahora().getTime()), ms);
    return () => clearInterval(id);
  }, [activo, ms]);
  return ahora;
}

export interface Nombres {
  /** Referencias encontradas, por `tipo|id`. */
  porClave: ReadonlyMap<string, ReferenciaDeEntidad>;
  /** Algún proveedor falló (Universidad no responde). */
  fallo: boolean;
  listo: boolean;
}

/** Resuelve nombres de materias/trabajos por id, por consulta (sin importar Universidad). */
export function useNombres(ctx: ContextoDeModulo, vinculos: readonly (Vinculo | null)[]): Nombres {
  const clave = [...new Set(vinculos.filter((v): v is Vinculo => !!v).map(claveDeVinculo))].sort().join(',');
  const [r, setR] = useState<Nombres>({ porClave: new Map(), fallo: false, listo: false });
  useEffect(() => {
    let vigente = true;
    const porTipo = new Map<string, string[]>();
    for (const k of clave ? clave.split(',') : []) {
      const v = vinculoDeClave(k)!;
      porTipo.set(v.tipo, [...(porTipo.get(v.tipo) ?? []), v.id]);
    }
    void Promise.all([...porTipo].map(([tipo, ids]) => ctx.integraciones.buscarReferencias({ tipo, ids, incluirInactivas: true }))).then(
      (resultados) => {
        if (!vigente) return;
        setR({
          porClave: new Map(resultados.flatMap((x) => x.referencias).map((x) => [claveDeVinculo(x), x])),
          fallo: resultados.some((x) => x.fallos.length > 0) || (porTipo.size > 0 && ctx.integraciones.tiposDeReferencia().length === 0),
          listo: true,
        });
      },
      () => vigente && setR({ porClave: new Map(), fallo: true, listo: true }),
    );
    return () => {
      vigente = false;
    };
  }, [clave, ctx.integraciones]);
  return r;
}

/** Nombre para mostrar: el de la referencia, "ya no existe" o "sin materia (Universidad no responde)". */
export function nombreDeVinculo(t: Traductor, v: Vinculo | null, n: Nombres): string {
  if (!v) return t('estudio.vinculoNinguno');
  const ref = n.porClave.get(claveDeVinculo(v));
  if (ref) return ref.detalle ? `${ref.titulo} · ${ref.detalle}` : ref.titulo;
  if (!n.listo) return t('estudio.vinculoCargando');
  return n.fallo ? t('estudio.vinculoSinRespuesta') : t('estudio.vinculoPerdido');
}

/** Materias y trabajos activos para elegir (por consulta). */
export function useOpciones(ctx: ContextoDeModulo): { tipo: string; referencias: ReferenciaDeEntidad[] }[] | null {
  const [r, setR] = useState<{ tipo: string; referencias: ReferenciaDeEntidad[] }[] | null>(null);
  useEffect(() => {
    let vigente = true;
    const tipos = TIPOS_VINCULABLES.filter((x) => ctx.integraciones.tiposDeReferencia().includes(x));
    void Promise.all(tipos.map((tipo) => ctx.integraciones.buscarReferencias({ tipo, limite: 100 }).then((x) => ({ tipo, referencias: x.referencias })))).then(
      (l) => vigente && setR(l.filter((x) => x.referencias.length > 0)),
      () => vigente && setR([]),
    );
    return () => {
      vigente = false;
    };
  }, [ctx.integraciones]);
  return r;
}
