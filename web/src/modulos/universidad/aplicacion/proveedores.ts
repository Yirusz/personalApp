/**
 * Integración por consulta (ADR-0013): Universidad ofrece, leyendo SOLO su almacén,
 * - una fuente de calendario con las fechas de entrega, y
 * - un proveedor de referencias de materias y trabajos (para Estudio y Notas).
 * Nadie importa este módulo: el núcleo los expone en `ctx.integraciones`.
 */
import type { ContextoDeModulo, Proveedores, ReferenciaDeEntidad } from '../../../nucleo/contrato';
import type { Materia } from '../dominio/materia';
import { elementoDeAgenda, esActivo, trabajoDesdeAlmacen, type Trabajo } from '../dominio/trabajo';
import { INDICE_POR_VENCIMIENTO, listarMaterias, MATERIAS, TRABAJOS } from './comun';

export const TIPO_MATERIA = 'universidad.materia';
export const TIPO_TRABAJO = 'universidad.trabajo';

const normalizar = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('es-CO');

export function referenciaDeMateria(m: Materia): ReferenciaDeEntidad {
  return { tipo: TIPO_MATERIA, id: m.id, titulo: m.nombre, detalle: [m.periodo, m.profesor].filter(Boolean).join(' · '), color: m.color, ruta: '/universidad/materias', activa: !m.archivada };
}

export function referenciaDeTrabajo(t: Trabajo, m: Materia | undefined): ReferenciaDeEntidad {
  return { tipo: TIPO_TRABAJO, id: t.id, titulo: t.titulo, ...(m ? { detalle: m.nombre, color: m.color } : {}), ruta: `/universidad/trabajos/${t.id}`, activa: esActivo(t.estado) };
}

export function crearProveedores(ctx: Pick<ContextoDeModulo, 'almacen'>): Proveedores {
  const alCambiar = (escucha: () => void) => ctx.almacen.alCambiar([MATERIAS, TRABAJOS], escucha);
  return {
    fuentesDeCalendario: [
      {
        id: 'universidad.entregas',
        nombre: 'universidad.fuenteCalendario',
        alCambiar,
        // Rango por índice de vencimiento: no lee todo el almacén. Los cancelados no se muestran; los de materias archivadas sí (son historia).
        elementos: (rango) =>
          ctx.almacen.leer([MATERIAS, TRABAJOS], async (tx) => {
            const colores = new Map((await listarMaterias(tx)).map((m) => [m.id, m.color]));
            const crudos = await tx.listar(TRABAJOS, { indice: INDICE_POR_VENCIMIENTO, desde: rango.desde, hasta: rango.hasta });
            return crudos
              .map(trabajoDesdeAlmacen)
              .filter((t) => t.estado !== 'cancelado' && t.venceEn < rango.hasta)
              .map((t) => elementoDeAgenda(t, colores.get(t.materiaId) ?? 'gris'));
          }),
      },
    ],
    referencias: {
      tipos: [TIPO_MATERIA, TIPO_TRABAJO],
      alCambiar,
      buscar: (c) =>
        ctx.almacen.leer([MATERIAS, TRABAJOS], async (tx) => {
          const materias = await listarMaterias(tx);
          const porId = new Map(materias.map((m) => [m.id, m]));
          const refs: ReferenciaDeEntidad[] = [];
          if (!c.tipo || c.tipo === TIPO_MATERIA) refs.push(...materias.map(referenciaDeMateria));
          if (!c.tipo || c.tipo === TIPO_TRABAJO) refs.push(...(await tx.listar(TRABAJOS, { indice: INDICE_POR_VENCIMIENTO })).map(trabajoDesdeAlmacen).map((t) => referenciaDeTrabajo(t, porId.get(t.materiaId))));
          const texto = c.texto ? normalizar(c.texto) : '';
          const filtradas = refs.filter(
            (r) => (c.incluirInactivas || r.activa || c.ids?.includes(r.id)) && (!c.ids || c.ids.includes(r.id)) && (!texto || normalizar(`${r.titulo} ${r.detalle ?? ''}`).includes(texto)),
          );
          return c.limite === undefined ? filtradas : filtradas.slice(0, c.limite);
        }),
    },
  };
}
