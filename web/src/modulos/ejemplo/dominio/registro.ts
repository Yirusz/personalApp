/**
 * Módulo de EJEMPLO: existe solo para recorrer el contrato de módulo de punta a
 * punta (ruta, navegación, almacenamiento con migraciones, evento → RPG).
 * Se puede borrar la carpeta completa sin tocar nada más.
 */

export const LONGITUD_MAXIMA = 140;

export class RegistroInvalido extends Error {
  override name = 'RegistroInvalido';
}

export interface Registro {
  readonly id: string;
  readonly texto: string;
  /** Instante UTC ISO 8601. */
  readonly creadoEn: string;
}

export function crearRegistro(id: string, texto: string, ahora: Date): Registro {
  const limpio = texto.trim();
  if (limpio.length > LONGITUD_MAXIMA) {
    throw new RegistroInvalido(`El texto no puede pasar de ${LONGITUD_MAXIMA} caracteres.`);
  }
  return { id, texto: limpio, creadoEn: ahora.toISOString() };
}
