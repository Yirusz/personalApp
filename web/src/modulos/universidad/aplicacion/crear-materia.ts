import { asegurarNombreUnico, crearMateria as crear, type DatosDeMateria, type Materia } from '../dominio/materia';
import { EVENTOS, MATERIAS, type ContextoDeCasoDeUso } from './comun';

/** U1: crea una materia con nombre único entre las activas y publica MateriaCreada. */
export function crearMateria(ctx: ContextoDeCasoDeUso, datos: Omit<DatosDeMateria, 'id'>): Promise<Materia> {
  return ctx.almacen.escribir([MATERIAS], async (tx) => {
    asegurarNombreUnico(datos.nombre, await tx.listar<Materia>(MATERIAS));
    const materia = crear({ ...datos, id: ctx.nuevoId() }, ctx.reloj.ahora());
    await tx.poner(MATERIAS, materia);
    tx.publicar(EVENTOS.MateriaCreada, { materiaId: materia.id, nombre: materia.nombre, color: materia.color });
    return materia;
  });
}
