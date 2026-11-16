/** Errores con nombre del negocio: clave i18n y campo del formulario si aplica. */
export type CampoDeEstudio = 'focoMin' | 'cortoMin' | 'largoMin' | 'largoCada' | 'duracion' | 'vinculo';

export class ErrorDeEstudio extends Error {
  override name = 'ErrorDeEstudio';
  constructor(
    readonly clave: string,
    mensaje: string,
    readonly campo?: CampoDeEstudio,
    readonly parametros?: Readonly<Record<string, string | number>>,
  ) {
    super(mensaje);
  }
}

/** La acción no aplica en el estado actual (p. ej. pausar algo pausado). */
export const estadoInvalido = (mensaje: string) => new ErrorDeEstudio('estudio.error.estado', mensaje);
