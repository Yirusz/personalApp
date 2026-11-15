import type { Clave, OpcionesDeLista, Transaccion, TransaccionDeLectura } from '../contrato';
import type { EventoDeDominio } from '../dominio/evento';

/** Acceso del núcleo a sus propios almacenes (`nucleo_*`), sin publicar eventos. */
export interface TransaccionDelNucleo extends TransaccionDeLectura {
  poner<T extends object>(almacen: string, valor: T): Promise<void>;
  borrar(almacen: string, clave: Clave): Promise<void>;
}

export type Modo = 'readonly' | 'readwrite';

/**
 * Puerto del motor de almacenamiento usado por el bus y por los servicios del núcleo.
 * Implementación: `infraestructura/almacen-indexeddb.ts`.
 */
export interface MotorDeAlmacen {
  ejecutar<R>(
    moduloId: string,
    almacenes: readonly string[],
    modo: Modo,
    fn: (tx: Transaccion, nucleo: TransaccionDelNucleo) => Promise<R>,
    almacenesDelNucleo?: readonly string[],
  ): Promise<R>;
  /** Se invoca después de confirmar una transacción que publicó eventos. */
  alPublicar(escucha: (eventos: readonly EventoDeDominio[]) => void): () => void;
}

/** Instantánea completa de la base local, para exportar e importar. */
export interface MotorDeRespaldo {
  versionesDeEsquema(): Promise<Record<string, number>>;
  exportarTodo(): Promise<Record<string, unknown[]>>;
  /** Reemplaza TODO el contenido en una sola transacción (todo o nada). */
  reemplazarTodo(datos: Readonly<Record<string, readonly unknown[]>>): Promise<void>;
  nombresDeAlmacenes(): readonly string[];
}

export type { OpcionesDeLista };
