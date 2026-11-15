/**
 * Registro del Service Worker con actualización a pedido del usuario (guía §3.3):
 * si hay una versión nueva esperando, se avisa y solo se activa cuando el
 * usuario pulsa "Actualizar".
 */
export interface ControlDeActualizacion {
  /** Activa la versión en espera y recarga. */
  aplicar(): void;
}

export type EstadoDelServiceWorker = 'no-soportado' | 'desactivado-en-desarrollo' | 'registrando' | 'activo' | 'error';

export function registrarServiceWorker(
  alHaberActualizacion: (control: ControlDeActualizacion) => void,
  alCambiarEstado: (estado: EstadoDelServiceWorker, detalle?: unknown) => void,
): void {
  if (!('serviceWorker' in navigator)) return alCambiarEstado('no-soportado');
  if (import.meta.env.DEV) return alCambiarEstado('desactivado-en-desarrollo');

  alCambiarEstado('registrando');
  // Solo se recarga si el usuario pidió actualizar. En la primera instalación el SW
  // toma el control con clients.claim() y también dispara 'controllerchange':
  // recargar ahí interrumpiría al usuario sin motivo.
  let actualizacionPedida = false;
  let recargando = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!actualizacionPedida || recargando) return;
    recargando = true;
    location.reload();
  });

  const ofrecer = (trabajador: ServiceWorker) =>
    alHaberActualizacion({
      aplicar: () => {
        actualizacionPedida = true;
        trabajador.postMessage({ tipo: 'SALTAR_ESPERA' });
      },
    });

  navigator.serviceWorker
    .register('./sw.js')
    .then((registro) => {
      alCambiarEstado('activo');
      // Solo es "actualización" si ya había un SW controlando la página.
      if (registro.waiting && navigator.serviceWorker.controller) ofrecer(registro.waiting);
      registro.addEventListener('updatefound', () => {
        const nuevo = registro.installing;
        nuevo?.addEventListener('statechange', () => {
          if (nuevo.state === 'installed' && navigator.serviceWorker.controller) ofrecer(nuevo);
        });
      });
      // Buscar versiones nuevas al volver a la app (bajo demanda, sin sondeo constante).
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') registro.update().catch(() => undefined);
      });
    })
    .catch((error: unknown) => alCambiarEstado('error', error));
}
