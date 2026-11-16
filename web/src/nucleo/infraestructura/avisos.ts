import type { Avisador } from '../contrato';

/** Para pruebas y contextos sin shell: no muestra nada. */
export const avisadorNulo: Avisador = { mostrar: () => undefined };
