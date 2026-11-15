import type { Migracion } from '../../../nucleo/contrato';
import { ENTREGABLES, INDICE_POR_ESTADO, INDICE_POR_MATERIA, INDICE_POR_VENCIMIENTO, MATERIAS } from '../aplicacion/comun';

/** Una migración publicada NUNCA se edita: los cambios de esquema se agregan como versión 2, 3… */
export const MIGRACIONES: readonly Migracion[] = [
  {
    version: 1,
    descripcion: 'Materias y entregables con índices por vencimiento, materia y estado',
    aplicar(ctx) {
      ctx.crearAlmacen(MATERIAS);
      ctx.crearAlmacen(ENTREGABLES);
      ctx.crearIndice(ENTREGABLES, INDICE_POR_VENCIMIENTO, 'venceEn');
      ctx.crearIndice(ENTREGABLES, INDICE_POR_MATERIA, ['materiaId', 'venceEn']);
      ctx.crearIndice(ENTREGABLES, INDICE_POR_ESTADO, ['estado', 'venceEn']);
    },
  },
];
