/**
 * Adaptador de almacenamiento sobre IndexedDB (ADR-0009).
 *
 * - Una sola base `ludus` con un almacén de objetos por agregado, prefijado con el módulo.
 * - Migraciones por módulo: cada módulo declara las suyas; el núcleo guarda en
 *   `nucleo_meta` qué versión tiene aplicada cada uno y sube la versión de la
 *   base solo cuando hay migraciones pendientes.
 * - Toda transacción de escritura incluye `nucleo_eventos` (bandeja de salida).
 *   Efecto buscado: IndexedDB serializa las escrituras, así que el orden de los
 *   UUIDv7 de los eventos coincide con el orden de confirmación (el bus depende de ello).
 */
import type {
  AlmacenDeModulo,
  Clave,
  ContextoDeMigracion,
  DeclaracionDeEvento,
  Migracion,
  OpcionesDeLista,
  Transaccion,
} from '../contrato';
import type { MotorDeAlmacen, MotorDeRespaldo, Modo, TransaccionDelNucleo } from '../aplicacion/puertos';
import type { EventoDeDominio } from '../dominio/evento';
import type { Reloj } from '../dominio/reloj';
import type { GeneradorUuidV7 } from '../dominio/uuidv7';

export class ErrorDeAlmacen extends Error {
  override name = 'ErrorDeAlmacen';
}

export interface EsquemaDeModulo {
  id: string;
  migraciones: readonly Migracion[];
  eventos?: Readonly<Record<string, DeclaracionDeEvento>>;
}

export const NUCLEO = 'nucleo';
const EVENTOS = 'nucleo_eventos';
const META = 'nucleo_meta';

/** Almacenes propios del núcleo (versión 1). */
export const ESQUEMA_DEL_NUCLEO: EsquemaDeModulo = {
  id: NUCLEO,
  migraciones: [
    {
      version: 1,
      descripcion: 'Metadatos de esquema, bandeja de eventos, cursores, ajustes y diagnóstico',
      aplicar(ctx) {
        ctx.crearAlmacen('meta', { clave: 'modulo' });
        ctx.crearAlmacen('eventos');
        ctx.crearIndice('eventos', 'por_tipo', 'tipo');
        ctx.crearAlmacen('cursores', { clave: 'suscripcion' });
        ctx.crearAlmacen('ajustes', { clave: 'clave' });
        ctx.crearAlmacen('diagnostico');
      },
    },
  ],
};

const PATRON_NOMBRE = /^[a-z][a-z0-9_]*$/;

export function nombreReal(moduloId: string, corto: string): string {
  if (!PATRON_NOMBRE.test(corto)) throw new ErrorDeAlmacen(`Nombre de almacén inválido: "${corto}"`);
  return `${moduloId}_${corto}`;
}

/** Promesa de una petición de IndexedDB. Esperarla no cierra la transacción. */
function pedir<T>(peticion: IDBRequest<T>): Promise<T> {
  return new Promise((resolver, rechazar) => {
    peticion.onsuccess = () => resolver(peticion.result);
    peticion.onerror = () => rechazar(peticion.error);
  });
}

function rango(o: OpcionesDeLista | undefined): IDBKeyRange | undefined {
  if (!o) return undefined;
  const { desde, hasta } = o;
  if (desde !== undefined && hasta !== undefined) return IDBKeyRange.bound(desde, hasta, !!o.excluirDesde, !!o.excluirHasta);
  if (desde !== undefined) return IDBKeyRange.lowerBound(desde, !!o.excluirDesde);
  if (hasta !== undefined) return IDBKeyRange.upperBound(hasta, !!o.excluirHasta);
  return undefined;
}

async function listarEn<T>(tx: IDBTransaction, almacen: string, o?: OpcionesDeLista): Promise<T[]> {
  const origen: IDBObjectStore | IDBIndex = o?.indice ? tx.objectStore(almacen).index(o.indice) : tx.objectStore(almacen);
  const r = rango(o);
  if (!o?.inverso) return pedir(origen.getAll(r, o?.limite)) as Promise<T[]>;
  // Orden descendente: cursor 'prev' (getAll no lo soporta).
  const salida: T[] = [];
  const limite = o.limite ?? Infinity;
  return new Promise((resolver, rechazar) => {
    const peticion = origen.openCursor(r, 'prev');
    peticion.onerror = () => rechazar(peticion.error);
    peticion.onsuccess = () => {
      const cursor = peticion.result;
      if (!cursor || salida.length >= limite) return resolver(salida);
      salida.push(cursor.value as T);
      cursor.continue();
    };
  });
}

function abrirBase(
  fabrica: IDBFactory,
  nombre: string,
  version?: number,
  alActualizar?: (db: IDBDatabase, tx: IDBTransaction, versionAnterior: number) => void,
): Promise<IDBDatabase> {
  return new Promise((resolver, rechazar) => {
    let errorDeMigracion: unknown;
    const peticion = version === undefined ? fabrica.open(nombre) : fabrica.open(nombre, version);
    peticion.onupgradeneeded = (evento) => {
      if (!alActualizar) return;
      try {
        alActualizar(peticion.result, peticion.transaction!, evento.oldVersion);
      } catch (error) {
        errorDeMigracion = error;
        peticion.transaction?.abort();
      }
    };
    peticion.onsuccess = () => resolver(peticion.result);
    peticion.onerror = () => rechazar(errorDeMigracion ?? peticion.error);
  });
}

async function versionesAplicadas(db: IDBDatabase): Promise<Map<string, number>> {
  if (!db.objectStoreNames.contains(META)) return new Map();
  const tx = db.transaction(META, 'readonly');
  const filas = await pedir(tx.objectStore(META).getAll()) as { modulo: string; version: number }[];
  return new Map(filas.map((f) => [f.modulo, f.version]));
}

function validarMigraciones(esquema: EsquemaDeModulo): void {
  esquema.migraciones.forEach((m, i) => {
    if (m.version !== i + 1) {
      throw new ErrorDeAlmacen(`Las migraciones de "${esquema.id}" deben ser 1, 2, 3…; la posición ${i + 1} tiene la versión ${m.version}`);
    }
  });
}

function contextoDeMigracion(db: IDBDatabase, tx: IDBTransaction, moduloId: string): ContextoDeMigracion {
  return {
    crearAlmacen: (nombre, opciones) => {
      db.createObjectStore(nombreReal(moduloId, nombre), { keyPath: opciones?.clave ?? 'id' });
    },
    borrarAlmacen: (nombre) => db.deleteObjectStore(nombreReal(moduloId, nombre)),
    crearIndice: (almacen, nombre, ruta, opciones) => {
      tx.objectStore(nombreReal(moduloId, almacen)).createIndex(nombre, ruta, { unique: !!opciones?.unico });
    },
    borrarIndice: (almacen, nombre) => tx.objectStore(nombreReal(moduloId, almacen)).deleteIndex(nombre),
    transformar: (almacen, fn) => {
      const peticion = tx.objectStore(nombreReal(moduloId, almacen)).openCursor();
      peticion.onsuccess = () => {
        const cursor = peticion.result;
        if (!cursor) return;
        const nuevo = fn(cursor.value);
        if (nuevo === undefined) cursor.delete();
        else cursor.update(nuevo);
        cursor.continue();
      };
    },
  };
}

export interface OpcionesDeApertura {
  nombre: string;
  esquemas: readonly EsquemaDeModulo[];
  reloj: Reloj;
  ids: GeneradorUuidV7;
  /** Para pruebas (fake-indexeddb); por defecto `globalThis.indexedDB`. */
  fabrica?: IDBFactory;
}

interface Escucha {
  almacenes: ReadonlySet<string> | '*';
  fn: () => void;
}

export class AlmacenIndexedDb implements MotorDeAlmacen, MotorDeRespaldo {
  private readonly escuchas = new Set<Escucha>();
  private readonly escuchasDeEventos = new Set<(eventos: readonly EventoDeDominio[]) => void>();
  private readonly esquemas: ReadonlyMap<string, EsquemaDeModulo>;
  /** Se invoca si otra pestaña necesita actualizar la base: esta conexión se cierra. */
  alCerrarPorOtraVersion?: () => void;

  private constructor(
    private readonly db: IDBDatabase,
    esquemas: readonly EsquemaDeModulo[],
    private readonly reloj: Reloj,
    private readonly ids: GeneradorUuidV7,
  ) {
    this.esquemas = new Map(esquemas.map((e) => [e.id, e]));
    db.onversionchange = () => {
      db.close();
      this.alCerrarPorOtraVersion?.();
    };
  }

  static async abrir(o: OpcionesDeApertura): Promise<AlmacenIndexedDb> {
    const fabrica = o.fabrica ?? globalThis.indexedDB;
    if (!fabrica) throw new ErrorDeAlmacen('Este navegador no ofrece IndexedDB; Ludus no puede guardar datos.');
    const esquemas = [ESQUEMA_DEL_NUCLEO, ...o.esquemas.filter((e) => e.id !== NUCLEO)];
    const vistos = new Set<string>();
    for (const e of esquemas) {
      if (vistos.has(e.id)) throw new ErrorDeAlmacen(`Módulo duplicado: ${e.id}`);
      vistos.add(e.id);
      validarMigraciones(e);
    }

    let db = await abrirBase(fabrica, o.nombre);
    const aplicadas = await versionesAplicadas(db);
    for (const e of esquemas) {
      const actual = aplicadas.get(e.id) ?? 0;
      if (actual > e.migraciones.length) {
        db.close();
        throw new ErrorDeAlmacen(
          `Los datos del módulo "${e.id}" vienen de una versión más nueva de Ludus (esquema ${actual} > ${e.migraciones.length}). Actualiza la app.`,
        );
      }
    }
    const pendientes = esquemas.flatMap((e) =>
      e.migraciones.slice(aplicadas.get(e.id) ?? 0).map((m) => ({ moduloId: e.id, migracion: m })),
    );

    if (pendientes.length > 0) {
      const versionAnterior = db.version;
      db.close();
      const instante = o.reloj.ahora().toISOString();
      db = await abrirBase(fabrica, o.nombre, versionAnterior + 1, (base, tx, anterior) => {
        if (anterior !== versionAnterior) {
          throw new ErrorDeAlmacen('Otra pestaña actualizó la base al mismo tiempo; recarga la app.');
        }
        const finales = new Map<string, number>();
        for (const { moduloId, migracion } of pendientes) {
          migracion.aplicar(contextoDeMigracion(base, tx, moduloId));
          finales.set(moduloId, migracion.version);
        }
        const meta = tx.objectStore(META);
        for (const [modulo, version] of finales) meta.put({ modulo, version, actualizadoEn: instante });
      });
    }

    const almacen = new AlmacenIndexedDb(db, esquemas, o.reloj, o.ids);
    const ultimo = await almacen.ultimoEventoId();
    if (ultimo) o.ids.asegurarPosteriorA(ultimo);
    return almacen;
  }

  cerrar(): void {
    this.db.close();
  }

  nombresDeAlmacenes(): readonly string[] {
    return Array.from(this.db.objectStoreNames);
  }

  async ultimoEventoId(): Promise<string | undefined> {
    const tx = this.db.transaction(EVENTOS, 'readonly');
    const [ultimo] = await listarEn<EventoDeDominio>(tx, EVENTOS, { inverso: true, limite: 1 });
    return ultimo?.id;
  }

  /** Vista restringida para un módulo: solo sus almacenes y sus eventos. */
  paraModulo(moduloId: string): AlmacenDeModulo {
    if (!this.esquemas.has(moduloId)) throw new ErrorDeAlmacen(`Módulo no registrado: ${moduloId}`);
    return {
      leer: (almacenes, fn) => this.ejecutar(moduloId, almacenes, 'readonly', (tx) => fn(tx)),
      escribir: (almacenes, fn) => this.ejecutar(moduloId, almacenes, 'readwrite', (tx) => fn(tx)),
      alCambiar: (almacenes, fn) =>
        this.escucharCambios(almacenes === '*' ? '*' : almacenes.map((a) => nombreReal(moduloId, a)), fn),
    };
  }

  escucharCambios(almacenesReales: readonly string[] | '*', fn: () => void): () => void {
    const escucha: Escucha = { almacenes: almacenesReales === '*' ? '*' : new Set(almacenesReales), fn };
    this.escuchas.add(escucha);
    return () => this.escuchas.delete(escucha);
  }

  alPublicar(escucha: (eventos: readonly EventoDeDominio[]) => void): () => void {
    this.escuchasDeEventos.add(escucha);
    return () => this.escuchasDeEventos.delete(escucha);
  }

  async ejecutar<R>(
    moduloId: string,
    almacenes: readonly string[],
    modo: Modo,
    fn: (tx: Transaccion, nucleo: TransaccionDelNucleo) => Promise<R>,
    almacenesDelNucleo: readonly string[] = [],
  ): Promise<R> {
    const esquema = this.esquemas.get(moduloId);
    if (!esquema) throw new ErrorDeAlmacen(`Módulo no registrado: ${moduloId}`);
    const delModulo = new Set(almacenes.map((a) => nombreReal(moduloId, a)));
    const delNucleo = new Set(almacenesDelNucleo.map((a) => nombreReal(NUCLEO, a)));
    const alcance = new Set([...delModulo, ...delNucleo]);
    if (modo === 'readwrite') alcance.add(EVENTOS);
    for (const nombre of alcance) {
      if (!this.db.objectStoreNames.contains(nombre)) {
        throw new ErrorDeAlmacen(`El almacén "${nombre}" no existe. ¿Falta una migración?`);
      }
    }

    const tx = this.db.transaction([...alcance], modo);
    const terminada = new Promise<void>((resolver, rechazar) => {
      tx.oncomplete = () => resolver();
      tx.onabort = () => rechazar(tx.error ?? new ErrorDeAlmacen('Transacción abortada'));
    });
    const publicados: EventoDeDominio[] = [];
    const cambiados = new Set<string>();

    const resolverModulo = (corto: string) => {
      const real = nombreReal(moduloId, corto);
      if (!delModulo.has(real)) {
        throw new ErrorDeAlmacen(`"${corto}" no está en el alcance de esta transacción de "${moduloId}"`);
      }
      return real;
    };
    const resolverNucleo = (corto: string) => {
      const real = nombreReal(NUCLEO, corto);
      if (!delNucleo.has(real)) throw new ErrorDeAlmacen(`"${real}" no está en el alcance de esta transacción`);
      return real;
    };
    const operaciones = (resolver: (c: string) => string): TransaccionDelNucleo => ({
      obtener: (a, clave: Clave) => pedir(tx.objectStore(resolver(a)).get(clave)),
      listar: (a, o) => listarEn(tx, resolver(a), o),
      contar: (a, o) => {
        const real = resolver(a);
        const origen = o?.indice ? tx.objectStore(real).index(o.indice) : tx.objectStore(real);
        return pedir(origen.count(rango(o)));
      },
      poner: async (a, valor) => {
        const real = resolver(a);
        await pedir(tx.objectStore(real).put(valor));
        cambiados.add(real);
      },
      borrar: async (a, clave) => {
        const real = resolver(a);
        await pedir(tx.objectStore(real).delete(clave));
        cambiados.add(real);
      },
    });

    const transaccion: Transaccion = {
      ...operaciones(resolverModulo),
      publicar: (tipo, datos, opciones) => {
        if (modo !== 'readwrite') throw new ErrorDeAlmacen('No se publican eventos en una transacción de lectura');
        const declaracion = esquema.eventos?.[tipo];
        if (!declaracion) throw new ErrorDeAlmacen(`"${moduloId}" no declaró el evento "${tipo}"`);
        const ahora = this.reloj.ahora().getTime();
        let ocurrido = ahora;
        if (opciones?.ocurridoEn !== undefined) {
          ocurrido = /^\d{4}-\d{2}-\d{2}T/.test(opciones.ocurridoEn) ? Date.parse(opciones.ocurridoEn) : NaN;
          if (Number.isNaN(ocurrido)) throw new ErrorDeAlmacen(`ocurridoEn inválido: ${opciones.ocurridoEn}`);
          if (ocurrido > ahora) throw new ErrorDeAlmacen('ocurridoEn no puede estar en el futuro');
        }
        const evento = {
          id: this.ids.siguiente(),
          tipo,
          modulo: moduloId,
          version: declaracion.version,
          ocurridoEn: new Date(ocurrido).toISOString(),
          datos,
        };
        // Sin await a propósito: un fallo aborta la transacción y se reporta abajo.
        tx.objectStore(EVENTOS).add(evento);
        publicados.push(evento);
        cambiados.add(EVENTOS);
        return evento;
      },
    };

    let resultado: R;
    try {
      resultado = await fn(transaccion, operaciones(resolverNucleo));
    } catch (error) {
      try {
        tx.abort();
      } catch {
        // La transacción ya había terminado; el error original es el relevante.
      }
      await terminada.catch(() => undefined);
      throw error;
    }
    tx.commit?.();
    await terminada;

    if (cambiados.size > 0) this.notificarCambios(cambiados);
    if (publicados.length > 0) for (const escucha of this.escuchasDeEventos) escucha(publicados);
    return resultado;
  }

  private notificarCambios(cambiados: ReadonlySet<string> | '*'): void {
    for (const escucha of this.escuchas) {
      const interesa =
        escucha.almacenes === '*' || cambiados === '*' || [...cambiados].some((c) => (escucha.almacenes as Set<string>).has(c));
      if (interesa) escucha.fn();
    }
  }

  // ---- Respaldo ----

  async versionesDeEsquema(): Promise<Record<string, number>> {
    return Object.fromEntries(await versionesAplicadas(this.db));
  }

  async exportarTodo(): Promise<Record<string, unknown[]>> {
    const nombres = this.nombresDeAlmacenes();
    const tx = this.db.transaction(nombres, 'readonly');
    const salida: Record<string, unknown[]> = {};
    for (const nombre of nombres) salida[nombre] = await pedir(tx.objectStore(nombre).getAll());
    return salida;
  }

  async reemplazarTodo(datos: Readonly<Record<string, readonly unknown[]>>): Promise<void> {
    const nombres = this.nombresDeAlmacenes();
    for (const nombre of Object.keys(datos)) {
      if (!nombres.includes(nombre)) throw new ErrorDeAlmacen(`El respaldo trae un almacén desconocido: ${nombre}`);
    }
    const tx = this.db.transaction(nombres, 'readwrite');
    const terminada = new Promise<void>((resolver, rechazar) => {
      tx.oncomplete = () => resolver();
      tx.onabort = () => rechazar(tx.error ?? new ErrorDeAlmacen('Importación abortada'));
    });
    try {
      for (const nombre of nombres) {
        const almacen = tx.objectStore(nombre);
        await pedir(almacen.clear());
        for (const valor of datos[nombre] ?? []) await pedir(almacen.put(valor));
      }
    } catch (error) {
      try {
        tx.abort();
      } catch {
        // ya abortada
      }
      await terminada.catch(() => undefined);
      throw error;
    }
    await terminada;
    const ultimo = await this.ultimoEventoId();
    if (ultimo) this.ids.asegurarPosteriorA(ultimo);
    this.notificarCambios('*');
  }

  async contarTodo(): Promise<Record<string, number>> {
    const nombres = this.nombresDeAlmacenes();
    const tx = this.db.transaction(nombres, 'readonly');
    const salida: Record<string, number> = {};
    for (const nombre of nombres) salida[nombre] = await pedir(tx.objectStore(nombre).count());
    return salida;
  }
}
