/**
 * Descubrimiento automático de módulos: cualquier carpeta `src/modulos/<id>/`
 * con un `modulo.ts` queda registrada. Agregar un módulo no modifica este
 * archivo ni ningún otro módulo (requisito de arquitectura, ADR-0010).
 */
import type { DefinicionDeModulo } from '../nucleo/contrato';

const encontrados = import.meta.glob<{ default: DefinicionDeModulo }>('./*/modulo.ts', { eager: true });

export const MODULOS: readonly DefinicionDeModulo[] = Object.values(encontrados).map((m) => m.default);
