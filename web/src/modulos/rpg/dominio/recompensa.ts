/** R4: recompensas propias. Valores objeto con mensajes de negocio. */
export const NOMBRE_MAX = 60;
export const COSTO_MAX = 100_000;

export class ErrorDeRecompensa extends Error {
  override name = 'ErrorDeRecompensa';
  constructor(
    readonly clave: string,
    readonly campo?: 'nombre' | 'costo',
    readonly parametros?: Readonly<Record<string, string | number>>,
  ) {
    super(clave);
  }
}

export function nombreDeRecompensa(valor: string): string {
  const limpio = valor.normalize('NFC').trim().replace(/\s+/g, ' ');
  if (!limpio) throw new ErrorDeRecompensa('rpg.error.nombreVacio', 'nombre');
  if (limpio.length > NOMBRE_MAX) throw new ErrorDeRecompensa('rpg.error.nombreLargo', 'nombre', { max: NOMBRE_MAX });
  return limpio;
}

export function costoDeRecompensa(valor: number): number {
  if (!Number.isInteger(valor) || valor < 1 || valor > COSTO_MAX) throw new ErrorDeRecompensa('rpg.error.costo', 'costo', { max: COSTO_MAX });
  return valor;
}
