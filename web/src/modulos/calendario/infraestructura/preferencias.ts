/** Última vista usada del calendario (preferencia de pantalla; si localStorage no está disponible, agenda). */
export const VISTAS = ['agenda', 'dia', 'semana', 'mes'] as const;
export type Vista = (typeof VISTAS)[number];

const CLAVE = 'ludus.calendario.vista';

export function leerVista(): Vista {
  try {
    const v = localStorage.getItem(CLAVE);
    return VISTAS.includes(v as Vista) ? (v as Vista) : 'agenda';
  } catch {
    return 'agenda';
  }
}

export function guardarVista(vista: Vista): void {
  try {
    localStorage.setItem(CLAVE, vista);
  } catch {
    // Sin persistencia: se usa la vista de la URL.
  }
}
