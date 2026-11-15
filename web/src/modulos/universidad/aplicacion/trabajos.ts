/**
 * Historias 2, 3, 5 y 6: casos de uso de trabajos. Cada uno guarda y publica en
 * la misma transacción. Las subtareas se guardan sin publicar eventos.
 */
import { NOTA_APROBATORIA } from '../dominio/nota';
import {
  agregarSubtarea as agregar,
  calificar,
  cancelar,
  editarSubtarea as editarSub,
  editarTrabajo as editar,
  entregar,
  iniciar,
  marcarSubtarea as marcar,
  quitarSubtarea as quitar,
  reabrir,
  registrarTrabajo as registrar,
  reprogramar,
  type CambiosDeTrabajo,
  type DatosDeTrabajo,
  type ResultadoDeEntrega,
  type Trabajo,
} from '../dominio/trabajo';
import { EVENTOS, MATERIAS, obtenerMateria, obtenerTrabajo, TRABAJOS, type ContextoDeCasoDeUso } from './comun';

export type DatosParaRegistrar = Omit<DatosDeTrabajo, 'id' | 'materia'> & { materiaId: string };

export function registrarTrabajo(ctx: ContextoDeCasoDeUso, datos: DatosParaRegistrar): Promise<Trabajo> {
  return ctx.almacen.escribir([MATERIAS, TRABAJOS], async (tx) => {
    const { materiaId, ...resto } = datos;
    const materia = await obtenerMateria(tx, materiaId);
    const { trabajo: t, antelacionHoras } = registrar({ ...resto, id: ctx.nuevoId(), materia }, ctx.reloj.ahora());
    await tx.poner(TRABAJOS, t);
    tx.publicar(EVENTOS.TrabajoCreado, { trabajoId: t.id, materiaId, tipo: t.tipo, peso: t.peso, venceEn: t.venceEn, antelacionHoras });
    return t;
  });
}

/** Aplica una función del dominio a un trabajo y lo guarda; publica si `evento` lo pide. */
function modificar<R>(
  ctx: ContextoDeCasoDeUso,
  id: string,
  fn: (t: Trabajo, ahora: Date) => { trabajo: Trabajo; resultado: R; evento?: [string, Record<string, unknown>] | null },
): Promise<R> {
  return ctx.almacen.escribir([TRABAJOS], async (tx) => {
    const actual = await obtenerTrabajo(tx, id);
    const { trabajo, resultado, evento } = fn(actual, ctx.reloj.ahora());
    if (trabajo !== actual) await tx.poner(TRABAJOS, trabajo);
    if (evento) tx.publicar(evento[0], evento[1]);
    return resultado;
  });
}

export function editarTrabajo(ctx: ContextoDeCasoDeUso, id: string, cambios: CambiosDeTrabajo): Promise<Trabajo> {
  return modificar(ctx, id, (t, ahora) => {
    const e = editar(t, cambios, ahora);
    const campos = (['titulo', 'tipo', 'descripcion', 'prioridad', 'peso'] as const).filter((c) => e[c] !== t[c]);
    return campos.length === 0 ? { trabajo: t, resultado: t } : { trabajo: e, resultado: e, evento: [EVENTOS.TrabajoEditado, { trabajoId: id, campos }] };
  });
}

export function reprogramarTrabajo(ctx: ContextoDeCasoDeUso, id: string, venceEn: string): Promise<Trabajo> {
  return modificar(ctx, id, (t, ahora) => {
    const { trabajo, venceEnAnterior } = reprogramar(t, venceEn, ahora);
    if (trabajo.venceEn === venceEnAnterior) return { trabajo: t, resultado: t };
    return { trabajo, resultado: trabajo, evento: [EVENTOS.TrabajoReprogramado, { trabajoId: id, venceEnAnterior, venceEn: trabajo.venceEn }] };
  });
}

export function iniciarTrabajo(ctx: ContextoDeCasoDeUso, id: string): Promise<Trabajo> {
  return modificar(ctx, id, (t, ahora) => {
    const e = iniciar(t, ahora);
    return { trabajo: e, resultado: e, evento: [EVENTOS.TrabajoIniciado, { trabajoId: id }] };
  });
}

/** Marca entregado con la fecha real del reloj; el RPG decide la XP por tipo, puntualidad y peso. */
export function entregarTrabajo(ctx: ContextoDeCasoDeUso, id: string): Promise<ResultadoDeEntrega> {
  return modificar(ctx, id, (t, ahora) => {
    const r = entregar(t, ahora);
    return {
      trabajo: r.trabajo,
      resultado: r,
      evento: [EVENTOS.TrabajoEntregado, { trabajoId: id, materiaId: t.materiaId, tipo: t.tipo, peso: t.peso, aTiempo: r.aTiempo, minutosDesdeCreacion: r.minutosDesdeCreacion }],
    };
  });
}

/** Registra o corrige la nota (décimas 0–50). */
export function calificarTrabajo(ctx: ContextoDeCasoDeUso, id: string, nota: number): Promise<Trabajo> {
  return modificar(ctx, id, (t, ahora) => {
    const e = calificar(t, nota, ahora);
    if (t.estado === 'calificado' && t.nota === e.nota) return { trabajo: t, resultado: t };
    return {
      trabajo: e,
      resultado: e,
      evento: [EVENTOS.TrabajoCalificado, { trabajoId: id, materiaId: t.materiaId, nota: e.nota, aprobado: e.nota! >= NOTA_APROBATORIA, correccion: t.estado === 'calificado' }],
    };
  });
}

export function cancelarTrabajo(ctx: ContextoDeCasoDeUso, id: string): Promise<Trabajo> {
  return modificar(ctx, id, (t, ahora) => {
    const e = cancelar(t, ahora);
    return { trabajo: e, resultado: e, evento: [EVENTOS.TrabajoCancelado, { trabajoId: id }] };
  });
}

export function reabrirTrabajo(ctx: ContextoDeCasoDeUso, id: string): Promise<Trabajo> {
  return modificar(ctx, id, (t, ahora) => {
    const e = reabrir(t, ahora);
    return { trabajo: e, resultado: e, evento: [EVENTOS.TrabajoReabierto, { trabajoId: id, desde: t.estado }] };
  });
}

/** La UI lo llama al vencer el "Deshacer". Si ya no existe, no hace nada. */
export function eliminarTrabajo(ctx: ContextoDeCasoDeUso, id: string): Promise<void> {
  return ctx.almacen.escribir([TRABAJOS], async (tx) => {
    if (!(await tx.obtener(TRABAJOS, id))) return;
    await tx.borrar(TRABAJOS, id);
    tx.publicar(EVENTOS.TrabajoEliminado, { trabajoId: id });
  });
}

// ---- Subtareas (sin eventos) ----

export function agregarSubtarea(ctx: ContextoDeCasoDeUso, id: string, texto: string): Promise<Trabajo> {
  return modificar(ctx, id, (t, ahora) => {
    const e = agregar(t, ctx.nuevoId(), texto, ahora);
    return { trabajo: e, resultado: e };
  });
}

export function marcarSubtarea(ctx: ContextoDeCasoDeUso, id: string, subtareaId: string, hecha: boolean): Promise<Trabajo> {
  return modificar(ctx, id, (t, ahora) => {
    const e = marcar(t, subtareaId, hecha, ahora);
    return { trabajo: e, resultado: e };
  });
}

export function editarSubtarea(ctx: ContextoDeCasoDeUso, id: string, subtareaId: string, texto: string): Promise<Trabajo> {
  return modificar(ctx, id, (t, ahora) => {
    const e = editarSub(t, subtareaId, texto, ahora);
    return { trabajo: e, resultado: e };
  });
}

export function quitarSubtarea(ctx: ContextoDeCasoDeUso, id: string, subtareaId: string): Promise<Trabajo> {
  return modificar(ctx, id, (t, ahora) => {
    const e = quitar(t, subtareaId, ahora);
    return { trabajo: e, resultado: e };
  });
}
