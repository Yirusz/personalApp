/**
 * Integración por consulta (ADR-0013). Los proveedores de cada módulo se crean
 * una sola vez, con el contexto del módulo que los ofrece (así solo leen SU
 * almacén). Un proveedor que falla no afecta a los demás.
 */
import type { ContextoDeModulo, DefinicionDeModulo, Integraciones, Proveedores, ResultadoDeFichas, ResultadoDeReferencias } from '../contrato';
import { normalizarFicha } from '../dominio/fichas';

export function crearIntegraciones(modulos: readonly DefinicionDeModulo[], contextoDe: (moduloId: string) => ContextoDeModulo): Integraciones {
  let cache: Map<string, Proveedores> | null = null;
  // Perezoso: los contextos se crean después del registro y pueden depender de esto.
  const proveedores = (): Map<string, Proveedores> => {
    if (cache) return cache;
    cache = new Map();
    for (const m of modulos) {
      if (!m.proveedores) continue;
      try {
        cache.set(m.id, m.proveedores(contextoDe(m.id)));
      } catch (error) {
        contextoDe(m.id).diagnostico.registrar('error', m.id, 'No se pudieron crear sus proveedores', error);
      }
    }
    return cache;
  };

  return {
    fuentesDeCalendario: () => [...proveedores()].flatMap(([modulo, p]) => (p.fuentesDeCalendario ?? []).map((fuente) => ({ modulo, fuente }))),
    tiposDeReferencia: () => [...proveedores().values()].flatMap((p) => p.referencias?.tipos ?? []),
    async buscarReferencias(consulta) {
      const candidatos = [...proveedores()].filter(([, p]) => p.referencias && (!consulta.tipo || p.referencias.tipos.includes(consulta.tipo)));
      const resultados = await Promise.allSettled(candidatos.map(([, p]) => p.referencias!.buscar(consulta)));
      const salida: ResultadoDeReferencias = { referencias: [], fallos: [] };
      resultados.forEach((r, i) => {
        if (r.status === 'fulfilled') salida.referencias.push(...r.value);
        else salida.fallos.push({ modulo: candidatos[i]![0], error: r.reason });
      });
      if (consulta.limite !== undefined) salida.referencias = salida.referencias.slice(0, consulta.limite);
      return salida;
    },
    async fichas() {
      const candidatos = [...proveedores()].filter(([, p]) => p.fichas);
      const resultados = await Promise.allSettled(candidatos.map(([, p]) => p.fichas!.fichas()));
      const salida: ResultadoDeFichas = { grupos: [], fallos: [] };
      resultados.forEach((r, i) => {
        const [modulo, p] = candidatos[i]!;
        const nombre = p.fichas!.nombre;
        if (r.status === 'rejected') {
          salida.fallos.push({ modulo, nombre, omitidas: 0, error: r.reason });
          return;
        }
        const fichas = [];
        let omitidas = 0;
        for (const f of r.value) {
          try {
            fichas.push(normalizarFicha(f));
          } catch {
            omitidas++;
          }
        }
        if (omitidas > 0) salida.fallos.push({ modulo, nombre, omitidas });
        salida.grupos.push({ modulo, nombre, fichas });
      });
      return salida;
    },
    alCambiarFichas(escucha) {
      const dejar = [...proveedores().values()].flatMap((p) => (p.fichas?.alCambiar ? [p.fichas.alCambiar(escucha)] : []));
      return () => dejar.forEach((d) => d());
    },
  };
}

/** Sin proveedores (pruebas, o módulos que no consumen nada). */
export const integracionesVacias: Integraciones = {
  fuentesDeCalendario: () => [],
  tiposDeReferencia: () => [],
  buscarReferencias: async () => ({ referencias: [], fallos: [] }),
  fichas: async () => ({ grupos: [], fallos: [] }),
  alCambiarFichas: () => () => undefined,
};
