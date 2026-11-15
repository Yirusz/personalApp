/**
 * Enrutador por hash (ADR-0010): `#/ruta`. Funciona en cualquier hosting estático
 * y con rutas relativas; cada navegación crea una entrada en el historial, así
 * el botón "atrás" de Android regresa de pantalla en lugar de salir de la app.
 */
import { useEffect, useState } from 'preact/hooks';

export function rutaActual(): string {
  const ruta = decodeURI(location.hash.replace(/^#/, ''));
  return ruta.startsWith('/') ? ruta : '/';
}

export function navegar(ruta: string): void {
  if (rutaActual() !== ruta) location.hash = ruta;
}

export function hrefDe(ruta: string): string {
  return `#${ruta}`;
}

/** Compara `/universidad/materias/:id` con `/universidad/materias/42` → `{ id: '42' }`. */
export function coincidir(patron: string, ruta: string): Record<string, string> | null {
  const partesPatron = patron.split('/').filter(Boolean);
  const partesRuta = ruta.split('?')[0]!.split('/').filter(Boolean);
  if (partesPatron.length !== partesRuta.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < partesPatron.length; i++) {
    const p = partesPatron[i]!;
    const r = partesRuta[i]!;
    if (p.startsWith(':')) params[p.slice(1)] = decodeURIComponent(r);
    else if (p !== r) return null;
  }
  return params;
}

export function useRuta(): string {
  const [ruta, setRuta] = useState(rutaActual);
  useEffect(() => {
    const alCambiar = () => setRuta(rutaActual());
    addEventListener('hashchange', alCambiar);
    return () => removeEventListener('hashchange', alCambiar);
  }, []);
  return ruta;
}
