/**
 * Apariencia (ADR-0007): dos ejes independientes sobre `<html>`:
 * - `data-esquema`: claro | oscuro (o sin atributo = según el sistema).
 * - `data-estilo`: minimal (hoy) | pixel (futuro: solo otra hoja de tokens).
 * Se guarda en localStorage para aplicarla antes de abrir la base (sin parpadeo).
 */
export type Esquema = 'sistema' | 'claro' | 'oscuro';
export type Estilo = 'minimal' | 'pixel';

export interface Apariencia {
  esquema: Esquema;
  estilo: Estilo;
}

const CLAVE = 'ludus.apariencia';
const POR_DEFECTO: Apariencia = { esquema: 'sistema', estilo: 'minimal' };

export function leerApariencia(): Apariencia {
  try {
    const guardada = JSON.parse(localStorage.getItem(CLAVE) ?? 'null') as Partial<Apariencia> | null;
    return {
      esquema: guardada?.esquema === 'claro' || guardada?.esquema === 'oscuro' ? guardada.esquema : 'sistema',
      estilo: 'minimal', // 'pixel' aún no existe
    };
  } catch {
    // localStorage puede no estar disponible (modo privado estricto): usar valores por defecto.
    return POR_DEFECTO;
  }
}

export function guardarApariencia(apariencia: Apariencia): void {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(apariencia));
  } catch {
    // Sin persistencia: se aplica solo en esta sesión.
  }
  aplicarApariencia(apariencia);
}

export function aplicarApariencia({ esquema, estilo }: Apariencia): void {
  const raiz = document.documentElement;
  if (esquema === 'sistema') raiz.removeAttribute('data-esquema');
  else raiz.setAttribute('data-esquema', esquema);
  raiz.setAttribute('data-estilo', estilo);
  // Color de la barra del sistema en Android, coherente con el fondo actual.
  const oscuro = esquema === 'oscuro' || (esquema === 'sistema' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', oscuro ? '#111614' : '#f6f8f7');
}
