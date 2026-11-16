/** E2: duraciones y ciclo del Pomodoro. Enteros en minutos; fuera de rango se rechaza. */
import { ErrorDeEstudio } from './errores';

export interface ConfiguracionPomodoro {
  focoMin: number;
  cortoMin: number;
  largoMin: number;
  /** Descanso largo después de cada N focos. */
  largoCada: number;
  /** Mantener la pantalla encendida durante la fase (solo si el navegador lo permite). */
  pantallaEncendida: boolean;
  /** Tono al terminar una fase. */
  sonido: boolean;
}

export const LIMITES = {
  focoMin: { min: 5, max: 90 },
  cortoMin: { min: 1, max: 60 },
  largoMin: { min: 1, max: 60 },
  largoCada: { min: 2, max: 8 },
} as const;

export const CONFIGURACION_INICIAL: ConfiguracionPomodoro = { focoMin: 25, cortoMin: 5, largoMin: 15, largoCada: 4, pantallaEncendida: false, sonido: true };

export function validarConfiguracion(c: ConfiguracionPomodoro): ConfiguracionPomodoro {
  for (const campo of Object.keys(LIMITES) as (keyof typeof LIMITES)[]) {
    const v = c[campo];
    const { min, max } = LIMITES[campo];
    if (!Number.isInteger(v) || v < min || v > max) throw new ErrorDeEstudio(`estudio.error.${campo}`, `${campo} fuera de ${min}–${max}`, campo, { min, max });
  }
  return { focoMin: c.focoMin, cortoMin: c.cortoMin, largoMin: c.largoMin, largoCada: c.largoCada, pantallaEncendida: !!c.pantallaEncendida, sonido: c.sonido !== false };
}

/** Datos guardados de una versión anterior o dañados: se completan con los valores iniciales. */
export function configuracionDesdeAlmacen(valor: unknown): ConfiguracionPomodoro {
  try {
    return validarConfiguracion({ ...CONFIGURACION_INICIAL, ...(valor as Partial<ConfiguracionPomodoro>) });
  } catch {
    return CONFIGURACION_INICIAL;
  }
}
