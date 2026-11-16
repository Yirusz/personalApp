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

const CLAVE_FICHAS = 'ludus.calendario.panelDeFichas';

/** ¿Panel de fichas abierto en día y semana? (cerrado por defecto). */
export function leerPanelDeFichas(): boolean {
  try {
    return localStorage.getItem(CLAVE_FICHAS) === '1';
  } catch {
    return false;
  }
}

export function guardarPanelDeFichas(abierto: boolean): void {
  try {
    localStorage.setItem(CLAVE_FICHAS, abierto ? '1' : '0');
  } catch {
    // Sin persistencia: dura mientras la pantalla esté abierta.
  }
}
