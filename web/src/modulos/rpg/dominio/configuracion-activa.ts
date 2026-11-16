/** Configuración vigente del RPG, validada al importar (falla rápido con un mensaje claro). */
import reglasV1 from '../reglas.v1.json';
import { validarConfiguracion } from './reglas';

export const REGLAS_DEL_RPG = validarConfiguracion(reglasV1);
