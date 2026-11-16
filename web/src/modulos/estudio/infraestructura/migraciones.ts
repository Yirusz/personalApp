import type { Migracion } from '../../../nucleo/contrato';
import { ESTADO, INDICE_POR_DIA, INDICE_POR_FIN, SESIONES } from '../aplicacion/comun';

/** Una migración publicada NUNCA se edita: los cambios de esquema se agregan como versión 2, 3… */
export const MIGRACIONES: readonly Migracion[] = [
  {
    version: 1,
    descripcion: 'Estado (sesión activa, ciclo y configuración) e historial de sesiones con índices por día y por fin',
    aplicar(ctx) {
      ctx.crearAlmacen(ESTADO, { clave: 'clave' });
      ctx.crearAlmacen(SESIONES);
      ctx.crearIndice(SESIONES, INDICE_POR_DIA, 'dia');
      ctx.crearIndice(SESIONES, INDICE_POR_FIN, 'finalizadaEn');
    },
  },
];
