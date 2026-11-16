import type { Migracion } from '../../../nucleo/contrato';
import { AGENDA, AVISOS, EVENTOS, FICHAS, INDICE_POR_UID, REVISIONES } from '../aplicacion/comun';

/** Una migración publicada NUNCA se edita: los cambios de esquema se agregan como versión 2, 3… */
export const MIGRACIONES: readonly Migracion[] = [
  {
    version: 1,
    descripcion: 'Eventos propios (índice único por UID), proyección de agenda, estado de avisos y revisiones semanales',
    aplicar(ctx) {
      ctx.crearAlmacen(EVENTOS);
      ctx.crearIndice(EVENTOS, INDICE_POR_UID, 'uid', { unico: true });
      ctx.crearAlmacen(AGENDA, { clave: 'clave' });
      ctx.crearAlmacen(AVISOS, { clave: 'clave' });
      ctx.crearAlmacen(REVISIONES, { clave: 'semana' });
    },
  },
  {
    version: 2,
    descripcion: 'Fichas propias (ADR-0015). Los eventos existentes no cambian: vínculo y ficha son opcionales.',
    aplicar(ctx) {
      ctx.crearAlmacen(FICHAS);
    },
  },
];
