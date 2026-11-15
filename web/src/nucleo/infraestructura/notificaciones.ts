/**
 * Adaptador de notificaciones del navegador. En Android Chrome `new Notification()`
 * lanza un error: hay que usar el Service Worker (`registration.showNotification`).
 * Solo funciona con la app abierta (ADR-0004).
 */
import type { Notificador, PermisoDeNotificaciones } from '../contrato';

function permisoActual(): PermisoDeNotificaciones {
  if (!('Notification' in globalThis)) return 'no-soportado';
  return Notification.permission === 'granted' ? 'concedido' : Notification.permission === 'denied' ? 'denegado' : 'preguntar';
}

export const notificadorDelNavegador: Notificador = {
  permiso: permisoActual,
  async pedirPermiso() {
    if (permisoActual() !== 'preguntar') return permisoActual();
    try {
      await Notification.requestPermission();
    } catch {
      // Navegadores viejos usan callback; el estado se relee abajo.
    }
    return permisoActual();
  },
  async mostrar({ titulo, cuerpo, etiqueta }) {
    if (permisoActual() !== 'concedido') return false;
    const opciones: NotificationOptions = { body: cuerpo, tag: etiqueta, icon: './icons/icono-192.png', lang: 'es-CO' };
    try {
      const registro = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : undefined;
      if (registro) {
        await registro.showNotification(titulo, opciones);
        return true;
      }
      new Notification(titulo, opciones);
      return true;
    } catch {
      return false;
    }
  },
};

/** Notificador nulo para pruebas y entornos sin soporte. */
export const notificadorNulo: Notificador = {
  permiso: () => 'no-soportado',
  pedirPermiso: async () => 'no-soportado',
  mostrar: async () => false,
};
