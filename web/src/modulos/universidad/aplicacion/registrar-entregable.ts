import { elementoDeAgenda, registrarEntregable as registrar, type DatosDeEntregable, type Entregable } from '../dominio/entregable';
import { ENTREGABLES, EVENTOS, MATERIAS, obtenerMateria, type ContextoDeCasoDeUso } from './comun';

export type DatosParaRegistrar = Omit<DatosDeEntregable, 'id' | 'materia'> & { materiaId: string };

/** U3: registra un entregable en una materia activa y publica EntregableCreado con datos.agenda. */
export function registrarEntregable(ctx: ContextoDeCasoDeUso, datos: DatosParaRegistrar): Promise<Entregable> {
  return ctx.almacen.escribir([MATERIAS, ENTREGABLES], async (tx) => {
    const materia = await obtenerMateria(tx, datos.materiaId);
    const { materiaId: _id, ...resto } = datos;
    const { entregable, antelacionHoras } = registrar({ ...resto, id: ctx.nuevoId(), materia }, ctx.reloj.ahora());
    await tx.poner(ENTREGABLES, entregable);
    tx.publicar(EVENTOS.EntregableCreado, {
      entregableId: entregable.id,
      materiaId: materia.id,
      talla: entregable.talla,
      venceEn: entregable.venceEn,
      antelacionHoras,
      agenda: elementoDeAgenda(entregable, materia.color),
    });
    return entregable;
  });
}
