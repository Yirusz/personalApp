/** CA10 y CA11: exportar e importar .ics. El lector/generador se carga solo cuando se usa (pantalla .ics). */
import type { ColorCategorico } from '../../../nucleo/dominio/agenda';
import type { TransaccionDeLectura } from '../../../nucleo/contrato';
import { ErrorDeCalendario } from '../dominio/errores';
import {
  cancelarOcurrencia,
  crearEvento,
  editarEvento,
  editarOcurrencia,
  type EventoDeCalendario,
} from '../dominio/evento';
import { elementoExterno } from '../dominio/externos';
import type { ElementoExterno } from '../dominio/visible';
import type { AvisoDeLectura, EventoImportable } from '../infraestructura/ics';
import { AGENDA, EVENTOS, INDICE_POR_UID, PUBLICADOS, zonaDelUsuario, type ContextoDeCasoDeUso, type RegistroDeAgenda } from './comun';

export interface AvisoDeImportacion extends Omit<AvisoDeLectura, 'motivo'> {
  motivo: AvisoDeLectura['motivo'] | 'invalido';
  /** Clave i18n del error de dominio cuando `motivo` es `invalido`. */
  error?: string;
}

export interface Preparacion {
  nombre: string | null;
  validos: EventoImportable[];
  avisos: AvisoDeImportacion[];
}

/** Arma un evento importable aplicando sus excepciones; las que no aplican se descartan en silencio. */
function construir(base: EventoDeCalendario, imp: EventoImportable, ahora: Date): EventoDeCalendario {
  const zona = zonaDelUsuario();
  let e = base;
  for (const [clave, ex] of Object.entries(imp.excepciones)) {
    try {
      e = ex.cancelada ? cancelarOcurrencia(e, clave, ahora, zona) : editarOcurrencia(e, clave, ex, ahora, zona);
    } catch {
      // Fecha excluida que no es ocurrencia (p. ej. tras normalizar el inicio): no aplica.
    }
  }
  return e;
}

/** Lee y valida sin guardar nada: es la vista previa. */
export async function prepararImportacion(texto: string, ahora: Date, color: ColorCategorico): Promise<Preparacion> {
  const { leerIcs } = await import('../infraestructura/ics');
  const zona = zonaDelUsuario();
  const lectura = leerIcs(texto, zona, color);
  const validos: EventoImportable[] = [];
  const avisos: AvisoDeImportacion[] = [...lectura.avisos];
  for (const imp of lectura.eventos) {
    try {
      crearEvento({ ...imp.datos, id: 'previa', uid: imp.uid }, zona, ahora);
      validos.push(imp);
    } catch (error) {
      avisos.push({ motivo: 'invalido', titulo: imp.datos.titulo, ...(error instanceof ErrorDeCalendario ? { error: error.clave } : {}) });
    }
  }
  return { nombre: lectura.nombre, validos, avisos };
}

/** Importa: crea los nuevos y actualiza los ya importados (mismo UID), sin duplicar. */
export function importarEventos(ctx: ContextoDeCasoDeUso, importables: readonly EventoImportable[]): Promise<{ creados: number; actualizados: number }> {
  return ctx.almacen.escribir([EVENTOS], async (tx) => {
    const zona = zonaDelUsuario();
    const ahora = ctx.reloj.ahora();
    let creados = 0;
    let actualizados = 0;
    for (const imp of importables) {
      const [existente] = await tx.listar<EventoDeCalendario>(EVENTOS, { indice: INDICE_POR_UID, desde: imp.uid, hasta: imp.uid });
      let e: EventoDeCalendario;
      if (existente) {
        e = construir({ ...editarEvento(existente, imp.datos, zona, ahora), excepciones: {} }, imp, ahora);
        actualizados++;
      } else {
        e = construir(crearEvento({ ...imp.datos, id: ctx.nuevoId(), uid: imp.uid }, zona, ahora), imp, ahora);
        creados++;
      }
      await tx.poner(EVENTOS, e);
    }
    tx.publicar(PUBLICADOS.CalendarioImportado, { creados, actualizados });
    return { creados, actualizados };
  });
}

export async function leerParaExportar(tx: TransaccionDeLectura, incluirExternos: boolean): Promise<{ eventos: EventoDeCalendario[]; externos: ElementoExterno[] }> {
  const eventos = await tx.listar<EventoDeCalendario>(EVENTOS);
  const externos: ElementoExterno[] = [];
  if (incluirExternos) {
    const zona = zonaDelUsuario();
    for (const r of await tx.listar<RegistroDeAgenda>(AGENDA)) {
      try {
        externos.push(elementoExterno(r.origen, r.agenda, zona));
      } catch {
        // Registro dañado: no se exporta.
      }
    }
  }
  return { eventos, externos };
}

export async function generarIcs(datos: { eventos: EventoDeCalendario[]; externos: ElementoExterno[] }, ahora: Date): Promise<string> {
  const { escribirIcs } = await import('../infraestructura/ics');
  return escribirIcs(datos.eventos, zonaDelUsuario(), ahora, { externos: datos.externos });
}
