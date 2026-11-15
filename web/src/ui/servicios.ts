import { createContext } from 'preact';
import { useContext, useEffect, useState } from 'preact/hooks';
import type { AlmacenDeModulo, ContextoDeModulo, TransaccionDeLectura } from '../nucleo/contrato';
import type { BusDeEventos } from '../nucleo/aplicacion/bus-de-eventos';
import type { RegistroDeModulos } from '../nucleo/aplicacion/registro-de-modulos';
import type { Reloj } from '../nucleo/dominio/reloj';
import type { Formatos, Traductor } from '../nucleo/i18n/traductor';
import type { AlmacenIndexedDb } from '../nucleo/infraestructura/almacen-indexeddb';
import type { RegistroDeDiagnostico } from '../nucleo/infraestructura/diagnostico';
import type { EstadoDelServiceWorker } from '../nucleo/infraestructura/service-worker';

/** Todo lo que el shell necesita; se construye una vez en `main.tsx` (raíz de composición). */
export interface ServiciosDeApp {
  version: string;
  registro: RegistroDeModulos;
  almacen: AlmacenIndexedDb;
  bus: BusDeEventos;
  diagnostico: RegistroDeDiagnostico;
  reloj: Reloj;
  t: Traductor;
  formatos: Formatos;
  contextoDe(moduloId: string): ContextoDeModulo;
  estadoDelServiceWorker(): EstadoDelServiceWorker;
}

export const ContextoDeServicios = createContext<ServiciosDeApp | null>(null);

export function useServicios(): ServiciosDeApp {
  const servicios = useContext(ContextoDeServicios);
  if (!servicios) throw new Error('useServicios fuera de <ContextoDeServicios.Provider>');
  return servicios;
}

export type EstadoDeConsulta<T> =
  | { estado: 'cargando' }
  | { estado: 'error'; error: unknown; reintentar: () => void }
  | { estado: 'listo'; datos: T; recargar: () => void };

/**
 * Lee datos de los almacenes de un módulo y vuelve a leer cuando cambian.
 * Cubre los estados cargando / error con reintento / listo (guía §15).
 */
export function useConsulta<T>(
  almacen: AlmacenDeModulo,
  almacenes: readonly string[],
  leer: (tx: TransaccionDeLectura) => Promise<T>,
): EstadoDeConsulta<T> {
  const [version, setVersion] = useState(0);
  const [estado, setEstado] = useState<EstadoDeConsulta<T>>({ estado: 'cargando' });
  const clave = almacenes.join('|');

  useEffect(() => almacen.alCambiar(almacenes, () => setVersion((v) => v + 1)), [almacen, clave]);

  useEffect(() => {
    let vigente = true;
    const recargar = () => setVersion((v) => v + 1);
    almacen
      .leer(almacenes, leer)
      .then((datos) => vigente && setEstado({ estado: 'listo', datos, recargar }))
      .catch((error: unknown) => vigente && setEstado({ estado: 'error', error, reintentar: recargar }));
    return () => {
      vigente = false;
    };
    // `leer` se omite a propósito: suele ser una función en línea; se relee al cambiar los datos.
  }, [almacen, clave, version]);

  return estado;
}

export function useEnLinea(): boolean {
  const [enLinea, setEnLinea] = useState(() => navigator.onLine);
  useEffect(() => {
    const actualizar = () => setEnLinea(navigator.onLine);
    addEventListener('online', actualizar);
    addEventListener('offline', actualizar);
    return () => {
      removeEventListener('online', actualizar);
      removeEventListener('offline', actualizar);
    };
  }, []);
  return enLinea;
}
