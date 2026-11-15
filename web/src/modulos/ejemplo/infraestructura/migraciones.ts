import type { Migracion } from '../../../nucleo/contrato';

/** Dos migraciones a propósito: muestran cómo evoluciona un esquema sin editar las anteriores. */
export const MIGRACIONES: readonly Migracion[] = [
  {
    version: 1,
    descripcion: 'Almacén de registros',
    aplicar: (ctx) => ctx.crearAlmacen('registros'),
  },
  {
    version: 2,
    descripcion: 'Índice por fecha de creación',
    aplicar: (ctx) => ctx.crearIndice('registros', 'por_creacion', 'creadoEn'),
  },
];
