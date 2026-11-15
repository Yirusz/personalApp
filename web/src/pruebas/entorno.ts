/** Utilidades de prueba: base en memoria aislada por prueba, reloj fijo y aleatoriedad determinista. */
import { IDBFactory } from 'fake-indexeddb';
import { BusDeEventos } from '../nucleo/aplicacion/bus-de-eventos';
import type { Diagnostico } from '../nucleo/contrato';
import { RelojFijo } from '../nucleo/dominio/reloj';
import { GeneradorUuidV7, type FuenteAleatoria } from '../nucleo/dominio/uuidv7';
import { AlmacenIndexedDb, type EsquemaDeModulo } from '../nucleo/infraestructura/almacen-indexeddb';

export function aleatorioDeterminista(semilla = 42): FuenteAleatoria {
  let estado = semilla >>> 0;
  return {
    llenar(bytes) {
      for (let i = 0; i < bytes.length; i++) {
        estado = (Math.imul(estado, 1664525) + 1013904223) >>> 0;
        bytes[i] = estado >>> 24;
      }
    },
  };
}

export interface EntradaRegistrada {
  nivel: string;
  origen: string;
  mensaje: string;
}

export function diagnosticoEnMemoria(): Diagnostico & { entradas: EntradaRegistrada[] } {
  const entradas: EntradaRegistrada[] = [];
  return { entradas, registrar: (nivel, origen, mensaje) => entradas.push({ nivel, origen, mensaje }) };
}

export interface Entorno {
  fabrica: IDBFactory;
  reloj: RelojFijo;
  ids: GeneradorUuidV7;
  almacen: AlmacenIndexedDb;
  bus: BusDeEventos;
  diagnostico: ReturnType<typeof diagnosticoEnMemoria>;
  /** Cierra y vuelve a abrir la misma base (simula reiniciar la app). */
  reabrir(esquemas?: readonly EsquemaDeModulo[]): Promise<Entorno>;
}

export async function crearEntorno(
  esquemas: readonly EsquemaDeModulo[],
  opciones: { fabrica?: IDBFactory; reloj?: RelojFijo; nombre?: string } = {},
): Promise<Entorno> {
  const fabrica = opciones.fabrica ?? new IDBFactory();
  const reloj = opciones.reloj ?? new RelojFijo('2026-11-14T15:00:00.000Z');
  const ids = new GeneradorUuidV7(reloj, aleatorioDeterminista());
  const nombre = opciones.nombre ?? 'prueba';
  const almacen = await AlmacenIndexedDb.abrir({ nombre, esquemas, reloj, ids, fabrica });
  const diagnostico = diagnosticoEnMemoria();
  const bus = new BusDeEventos(almacen, diagnostico, reloj);
  return {
    fabrica,
    reloj,
    ids,
    almacen,
    bus,
    diagnostico,
    async reabrir(nuevos = esquemas) {
      almacen.cerrar();
      return crearEntorno(nuevos, { fabrica, reloj, nombre });
    },
  };
}
