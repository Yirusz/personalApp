/**
 * Agregación de fuentes del calendario, tolerante a fallos: cada fuente se lee
 * en su propia transacción; si una falla (o tiene registros dañados) se
 * muestra el resto y un aviso con la fuente afectada.
 */
import type { AlmacenDeModulo, Integraciones } from '../../../nucleo/contrato';
import type { Zona } from '../../../nucleo/dominio/zona-horaria';
import type { EventoDeCalendario } from '../dominio/evento';
import { ocurrenciasEnRango } from '../dominio/expansion';
import { elementoExterno } from '../dominio/externos';
import { porInicio, seSolapa, type ElementoVisible, type Rango } from '../dominio/visible';
import { AGENDA, EVENTOS, type RegistroDeAgenda } from './comun';

export type IdDeFuente = 'propios' | 'externos';

interface Fuente<R> {
  id: IdDeFuente;
  almacen: string;
  expandir(registro: R, rango: Rango, zona: Zona): ElementoVisible[];
}

export const FUENTES: readonly Fuente<unknown>[] = [
  { id: 'propios', almacen: EVENTOS, expandir: (r, rango, zona) => ocurrenciasEnRango(r as EventoDeCalendario, rango, zona) },
  {
    id: 'externos',
    almacen: AGENDA,
    expandir: (r, rango, zona) => {
      const reg = r as RegistroDeAgenda;
      const x = elementoExterno(reg.origen, reg.agenda, zona);
      return (x.puntual ? x.inicioMs >= rango.desdeMs && x.inicioMs < rango.hastaMs : x.inicioMs < rango.hastaMs && x.finMs > rango.desdeMs) ? [x] : [];
    },
  },
];

export const ALMACENES_DE_FUENTES = FUENTES.map((f) => f.almacen);

export interface Lectura {
  registros: ReadonlyMap<IdDeFuente, readonly unknown[]>;
  fallos: readonly { fuente: IdDeFuente; error: unknown }[];
}

export async function leerFuentes(almacen: AlmacenDeModulo, fuentes: readonly Fuente<unknown>[] = FUENTES): Promise<Lectura> {
  const resultados = await Promise.allSettled(fuentes.map((f) => almacen.leer([f.almacen], (tx) => tx.listar<unknown>(f.almacen))));
  const registros = new Map<IdDeFuente, readonly unknown[]>();
  const fallos: { fuente: IdDeFuente; error: unknown }[] = [];
  resultados.forEach((r, i) => {
    const id = fuentes[i]!.id;
    if (r.status === 'fulfilled') registros.set(id, r.value);
    else fallos.push({ fuente: id, error: r.reason });
  });
  return { registros, fallos };
}

/** Una fuente con problemas: no se pudo leer, o tenía registros dañados que se omitieron. */
export interface FalloDeFuente {
  fuente: string;
  /** Clave i18n del nombre visible. */
  nombre: string;
  omitidos: number;
  error?: unknown;
}

export interface Visibles {
  elementos: ElementoVisible[];
  fallos: FalloDeFuente[];
}

const nombreLocal = (id: IdDeFuente) => `calendario.fuente.${id}`;

/** Expande todo lo leído para un rango. Un registro dañado se omite y cuenta como fallo de su fuente. */
/**
 * `omitirOrigenes`: módulos que ya ofrecen una fuente registrada (ADR-0013); lo que
 * la proyección copió de ellos por eventos se ignora para no duplicar.
 */
export function visiblesEnRango(lectura: Lectura, rango: Rango, zona: Zona, omitirOrigenes: ReadonlySet<string> = new Set(), fuentes: readonly Fuente<unknown>[] = FUENTES): Visibles {
  const elementos: ElementoVisible[] = [];
  const fallos: FalloDeFuente[] = lectura.fallos.map((f) => ({ fuente: f.fuente, nombre: nombreLocal(f.fuente), omitidos: 0, error: f.error }));
  for (const fuente of fuentes) {
    let omitidos = 0;
    for (const registro of lectura.registros.get(fuente.id) ?? []) {
      if (fuente.id === 'externos' && omitirOrigenes.has((registro as RegistroDeAgenda).origen)) continue;
      try {
        elementos.push(...fuente.expandir(registro, rango, zona));
      } catch {
        omitidos++;
      }
    }
    if (omitidos > 0) fallos.push({ fuente: fuente.id, nombre: nombreLocal(fuente.id), omitidos });
  }
  return { elementos: elementos.sort(porInicio), fallos };
}

// ---------------------------------------------------------------------------
// Fuentes registradas por otros módulos (consulta, ADR-0013)
// ---------------------------------------------------------------------------

export interface LecturaRegistrada {
  elementos: ElementoVisible[];
  fallos: FalloDeFuente[];
  /** Módulos con fuente registrada (para no duplicar su proyección por eventos). */
  origenes: ReadonlySet<string>;
}

/** Consulta cada fuente registrada por separado: una que falle no afecta a las demás. */
export async function leerFuentesRegistradas(integraciones: Integraciones, rango: Rango, zona: Zona): Promise<LecturaRegistrada> {
  const fuentes = integraciones.fuentesDeCalendario().filter((f) => f.modulo !== 'calendario');
  const consulta = { desde: new Date(rango.desdeMs).toISOString(), hasta: new Date(rango.hastaMs).toISOString() };
  const resultados = await Promise.allSettled(fuentes.map((f) => f.fuente.elementos(consulta)));
  const elementos: ElementoVisible[] = [];
  const fallos: FalloDeFuente[] = [];
  resultados.forEach((r, i) => {
    const { modulo, fuente } = fuentes[i]!;
    if (r.status === 'rejected') {
      fallos.push({ fuente: fuente.id, nombre: fuente.nombre, omitidos: 0, error: r.reason });
      return;
    }
    let omitidos = 0;
    for (const a of r.value) {
      try {
        const x = elementoExterno(modulo, a, zona);
        if (seSolapa(x, rango)) elementos.push(x);
      } catch {
        omitidos++;
      }
    }
    if (omitidos > 0) fallos.push({ fuente: fuente.id, nombre: fuente.nombre, omitidos });
  });
  return { elementos, fallos, origenes: new Set(fuentes.map((f) => f.modulo)) };
}

export function combinar(local: Visibles, registradas: LecturaRegistrada): Visibles {
  return { elementos: [...local.elementos, ...registradas.elementos].sort(porInicio), fallos: [...local.fallos, ...registradas.fallos] };
}
