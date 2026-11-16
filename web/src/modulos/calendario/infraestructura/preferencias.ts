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

/** ¿Barra de fichas abierta? Si nunca se eligió: abierta en pantallas anchas (≥ 960 px), cerrada en las demás. */
export function leerPanelDeFichas(): boolean {
  const porDefecto = typeof matchMedia === 'function' && matchMedia('(min-width: 960px)').matches;
  try {
    const v = localStorage.getItem(CLAVE_FICHAS);
    return v === null ? porDefecto : v === '1';
  } catch {
    return porDefecto;
  }
}

export function guardarPanelDeFichas(abierto: boolean): void {
  try {
    localStorage.setItem(CLAVE_FICHAS, abierto ? '1' : '0');
  } catch {
    // Sin persistencia: dura mientras la pantalla esté abierta.
  }
}
