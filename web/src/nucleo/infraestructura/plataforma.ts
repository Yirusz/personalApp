/**
 * Adaptadores de capacidades del navegador (guía §6: la UI nunca llama directo
 * a una API del navegador). Todo con detección de capacidades.
 */

export interface EstadoDelAlmacenamiento {
  persistente: boolean | null; // null = el navegador no lo informa
  usadoBytes?: number;
  cuotaBytes?: number;
}

/** Pide que el navegador no borre los datos por falta de espacio (guía §3.3). */
export async function pedirAlmacenamientoPersistente(): Promise<boolean | null> {
  if (!('storage' in navigator) || typeof navigator.storage.persist !== 'function') return null;
  if (await navigator.storage.persisted()) return true;
  return navigator.storage.persist();
}

export async function estadoDelAlmacenamiento(): Promise<EstadoDelAlmacenamiento> {
  if (!('storage' in navigator)) return { persistente: null };
  const [persistente, estimado] = await Promise.all([
    typeof navigator.storage.persisted === 'function' ? navigator.storage.persisted() : Promise.resolve(null),
    typeof navigator.storage.estimate === 'function' ? navigator.storage.estimate() : Promise.resolve(undefined),
  ]);
  return { persistente, usadoBytes: estimado?.usage, cuotaBytes: estimado?.quota };
}

/** Descarga un texto como archivo (funciona en todos los navegadores, también Android). */
export function descargarArchivo(nombre: string, contenido: string, tipo = 'application/json'): void {
  const url = URL.createObjectURL(new Blob([contenido], { type: `${tipo};charset=utf-8` }));
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombre;
  enlace.rel = 'noopener';
  document.body.append(enlace);
  enlace.click();
  enlace.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Lee como texto un archivo elegido con `<input type="file">`. */
export function leerArchivoComoTexto(archivo: Blob): Promise<string> {
  return archivo.text();
}

export interface Capacidades {
  serviceWorker: boolean;
  notificaciones: boolean;
  vibracion: boolean;
  accesoACarpetas: boolean;
  almacenamientoPersistente: boolean;
}

export function detectarCapacidades(): Capacidades {
  return {
    serviceWorker: 'serviceWorker' in navigator,
    notificaciones: 'Notification' in globalThis,
    vibracion: typeof navigator.vibrate === 'function',
    accesoACarpetas: 'showDirectoryPicker' in globalThis,
    almacenamientoPersistente: 'storage' in navigator && typeof navigator.storage.persist === 'function',
  };
}
