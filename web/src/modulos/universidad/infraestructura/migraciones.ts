import type { Migracion } from '../../../nucleo/contrato';
import { INDICE_POR_ESTADO, INDICE_POR_MATERIA, INDICE_POR_VENCIMIENTO, MATERIAS, TRABAJOS } from '../aplicacion/comun';
import { materiaDesdeAlmacen } from '../dominio/materia';
import { trabajoDesdeAlmacen } from '../dominio/trabajo';

/** Una migración publicada NUNCA se edita: los cambios de esquema se agregan como versión 2, 3… */
export const MIGRACIONES: readonly Migracion[] = [
  {
    version: 1,
    descripcion: 'Materias y entregables con índices por vencimiento, materia y estado',
    aplicar(ctx) {
      ctx.crearAlmacen(MATERIAS);
      ctx.crearAlmacen(TRABAJOS);
      ctx.crearIndice(TRABAJOS, INDICE_POR_VENCIMIENTO, 'venceEn');
      ctx.crearIndice(TRABAJOS, INDICE_POR_MATERIA, ['materiaId', 'venceEn']);
      ctx.crearIndice(TRABAJOS, INDICE_POR_ESTADO, ['estado', 'venceEn']);
    },
  },
  {
    version: 2,
    descripcion: 'Entregable → Trabajo (tipos y estados nuevos, sin talla, peso, descripción y subtareas); materias con profesor y periodo',
    aplicar(ctx) {
      ctx.transformar(TRABAJOS, trabajoDesdeAlmacen);
      ctx.transformar(MATERIAS, materiaDesdeAlmacen);
    },
  },
];
