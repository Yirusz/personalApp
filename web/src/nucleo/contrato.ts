/**
 * Contrato de módulo de Ludus (ver docs/arquitectura.md §2).
 *
 * Un módulo es una carpeta `src/modulos/<id>/` con un `modulo.ts` que exporta
 * por defecto una `DefinicionDeModulo`. El núcleo la descubre sola: agregar un
 * módulo NO requiere modificar ningún otro archivo.
 *
 * Reglas:
 * - Un módulo solo ve SUS almacenes (nombres cortos; el núcleo antepone `<id>_`).
 * - Solo publica los eventos que declara en `eventos`, con tipo `<id>.<Nombre>`.
 * - No importa código de otros módulos (lo verifica `arquitectura.test.ts`).
 * - Se comunica con los demás por eventos y, por consulta, con proveedores (ADR-0013).
 */
import type { ColorCategorico, ElementoDeAgenda } from './dominio/agenda';
import type { ComponentType } from 'preact';
import type { EventoDeDominio } from './dominio/evento';
import type { Reloj } from './dominio/reloj';
import type { Formatos, Traductor } from './i18n/traductor';

export type Clave = IDBValidKey;

export interface OpcionesDeLista {
  /** Índice por el que consultar; sin él, la clave primaria. */
  indice?: string;
  desde?: Clave;
  hasta?: Clave;
  excluirDesde?: boolean;
  excluirHasta?: boolean;
  limite?: number;
  /** Orden descendente. */
  inverso?: boolean;
}

export interface TransaccionDeLectura {
  obtener<T>(almacen: string, clave: Clave): Promise<T | undefined>;
  listar<T>(almacen: string, opciones?: OpcionesDeLista): Promise<T[]>;
  contar(almacen: string, opciones?: OpcionesDeLista): Promise<number>;
}

/**
 * Unidad de trabajo atómica: o se guardan todos los cambios y eventos, o ninguno.
 * Dentro de la función solo se debe esperar (`await`) a operaciones de esta
 * transacción; esperar otra cosa (red, temporizadores) la cierra (IndexedDB).
 */
export interface Transaccion extends TransaccionDeLectura {
  poner<T extends object>(almacen: string, valor: T): Promise<void>;
  borrar(almacen: string, clave: Clave): Promise<void>;
  /** Registra un evento en la bandeja de salida; se entrega a los suscriptores al confirmar. */
  publicar<D extends Record<string, unknown>>(tipo: string, datos: D): EventoDeDominio<D>;
}

export interface AlmacenDeModulo {
  leer<R>(almacenes: readonly string[], fn: (tx: TransaccionDeLectura) => Promise<R>): Promise<R>;
  escribir<R>(almacenes: readonly string[], fn: (tx: Transaccion) => Promise<R>): Promise<R>;
  /** Avisa cuando se confirma una transacción que tocó alguno de esos almacenes. Devuelve la función para cancelar. */
  alCambiar(almacenes: readonly string[] | '*', escucha: () => void): () => void;
}

/** API declarativa de migraciones (portable a SQLite si algún día se usa Tauri). */
export interface ContextoDeMigracion {
  crearAlmacen(nombre: string, opciones?: { clave?: string }): void;
  borrarAlmacen(nombre: string): void;
  crearIndice(almacen: string, nombre: string, ruta: string | string[], opciones?: { unico?: boolean }): void;
  borrarIndice(almacen: string, nombre: string): void;
  /** Reescribe cada registro; devolver `undefined` lo elimina. */
  transformar(almacen: string, fn: (valor: unknown) => unknown): void;
}

export interface Migracion {
  /** 1, 2, 3… consecutivas. Una migración publicada NUNCA se edita: se agrega otra. */
  version: number;
  descripcion: string;
  aplicar(ctx: ContextoDeMigracion): void;
}

export interface Suscripcion {
  /** Único en toda la app; convención `<modulo>.<nombre>`. */
  id: string;
  /** Tipos de evento que le interesan, o `'*'` para todos. */
  tipos: readonly string[] | '*';
  /** Almacenes propios que `manejar` necesita escribir. */
  almacenes: readonly string[];
  /** `completo` (por defecto) procesa también el historial anterior a su registro. */
  historial?: 'completo' | 'desdeAhora';
  /** Corre en la misma transacción que avanza su cursor: entrega exactamente una vez. */
  manejar(evento: EventoDeDominio, tx: Transaccion): Promise<void>;
}

export interface Diagnostico {
  registrar(nivel: 'error' | 'aviso' | 'info', origen: string, mensaje: string, detalle?: unknown): void;
}

// ---------------------------------------------------------------------------
// Integración por consulta (ADR-0013): un módulo ofrece datos de SU almacén a
// los demás sin que lo conozcan. El núcleo los agrega y aísla los fallos.
// ---------------------------------------------------------------------------

/** Rango de consulta en instantes UTC ISO 8601: [desde, hasta). */
export interface RangoDeConsulta {
  desde: string;
  hasta: string;
}

/** Elementos que un módulo aporta al calendario (lenguaje publicado ElementoDeAgenda). */
export interface FuenteDeCalendario {
  /** Único en la app: `<modulo>.<nombre>`. */
  id: string;
  /** Clave i18n del nombre visible (p. ej. "Entregas de Universidad"). */
  nombre: string;
  elementos(rango: RangoDeConsulta): Promise<ElementoDeAgenda[]>;
  /** Avisa cuando sus datos cambian; devuelve cómo dejar de escuchar. */
  alCambiar(escucha: () => void): () => void;
}

/** Referencia a una entidad de otro módulo, para vincularla (p. ej. Estudio → materia). */
export interface ReferenciaDeEntidad {
  /** `<modulo>.<entidad>`, p. ej. `universidad.materia`. */
  tipo: string;
  id: string;
  titulo: string;
  detalle?: string;
  color?: ColorCategorico;
  ruta?: string;
  /** false = archivada, cancelada, terminada… (se sigue pudiendo mostrar). */
  activa: boolean;
}

export interface ConsultaDeReferencias {
  tipo?: string;
  texto?: string;
  ids?: readonly string[];
  incluirInactivas?: boolean;
  limite?: number;
}

export interface ProveedorDeReferencias {
  tipos: readonly string[];
  buscar(consulta: ConsultaDeReferencias): Promise<ReferenciaDeEntidad[]>;
  alCambiar?(escucha: () => void): () => void;
}

export interface Proveedores {
  fuentesDeCalendario?: readonly FuenteDeCalendario[];
  referencias?: ProveedorDeReferencias;
}

export interface ResultadoDeReferencias {
  referencias: ReferenciaDeEntidad[];
  /** Proveedores que fallaron (el resto se devuelve igual). */
  fallos: { modulo: string; error: unknown }[];
}

/** Lo que el núcleo ofrece a cada módulo para consumir proveedores de otros. */
export interface Integraciones {
  fuentesDeCalendario(): readonly { modulo: string; fuente: FuenteDeCalendario }[];
  tiposDeReferencia(): readonly string[];
  buscarReferencias(consulta: ConsultaDeReferencias): Promise<ResultadoDeReferencias>;
}

export type PermisoDeNotificaciones = 'concedido' | 'denegado' | 'preguntar' | 'no-soportado';

/**
 * Puerto de notificaciones del sistema. En una PWA solo funcionan con la app
 * abierta (ADR-0004); un empaquetado nativo (Tauri) daría otro adaptador.
 */
export interface Notificador {
  permiso(): PermisoDeNotificaciones;
  /** Debe llamarse desde un gesto del usuario (clic). */
  pedirPermiso(): Promise<PermisoDeNotificaciones>;
  /** Devuelve `false` si no se pudo mostrar (sin permiso o sin soporte); nunca lanza. */
  mostrar(aviso: { titulo: string; cuerpo?: string; etiqueta?: string }): Promise<boolean>;
}

export interface ContextoDeModulo {
  readonly moduloId: string;
  readonly almacen: AlmacenDeModulo;
  readonly reloj: Reloj;
  /** Nuevo UUIDv7 para identificar entidades. */
  nuevoId(): string;
  readonly t: Traductor;
  readonly formatos: Formatos;
  readonly diagnostico: Diagnostico;
  readonly notificaciones: Notificador;
  /** Proveedores de otros módulos (ADR-0013). */
  readonly integraciones: Integraciones;
  /** Con `reemplazar` no se agrega una entrada al historial. */
  navegar(ruta: string, opciones?: { reemplazar?: boolean }): void;
}

export interface PropsDeVista {
  ctx: ContextoDeModulo;
  params: Readonly<Record<string, string>>;
}

export interface RutaDeModulo {
  /** Ruta con parámetros opcionales, p. ej. `/universidad/materias/:id`. */
  patron: string;
  /** Clave i18n del título de la pantalla. */
  titulo: string;
  /** Carga diferida: cada pantalla es un trozo de JS aparte. */
  vista: () => Promise<ComponentType<PropsDeVista>>;
}

export interface EntradaDeNavegacion {
  /** Clave i18n. */
  etiqueta: string;
  /** `d` de un `<path>` SVG 24×24 dibujado con trazo. */
  icono: string;
  /** Posición en la barra (menor = primero). */
  orden: number;
  ruta: string;
}

export interface TarjetaDeInicio {
  orden: number;
  vista: () => Promise<ComponentType<{ ctx: ContextoDeModulo }>>;
}

export interface DeclaracionDeEvento {
  version: number;
  descripcion: string;
}

export interface DefinicionDeModulo {
  /** Minúsculas y dígitos; prefijo de almacenes, eventos, textos y rutas. */
  id: string;
  /** SemVer del módulo. */
  version: string;
  /** Clave i18n del nombre visible. */
  nombre: string;
  /** Textos es-CO; todas las claves empiezan por `<id>.`. */
  textos: Readonly<Record<string, string>>;
  navegacion?: EntradaDeNavegacion;
  rutas: readonly RutaDeModulo[];
  migraciones: readonly Migracion[];
  eventos: Readonly<Record<string, DeclaracionDeEvento>>;
  suscripciones?: (ctx: ContextoDeModulo) => readonly Suscripcion[];
  tarjetasDeInicio?: readonly TarjetaDeInicio[];
  /**
   * Tarea que corre mientras la app está abierta, en cualquier pantalla (p. ej.
   * recordatorios o el fin de un Pomodoro). Se inicia tras el arranque; devuelve
   * la función que la detiene. Debe ser liviana y tolerar ser congelada (Android).
   */
  alIniciar?: (ctx: ContextoDeModulo) => () => void;
  /** Datos que el módulo ofrece por consulta a los demás (ADR-0013). Se llama una vez, con el contexto del propio módulo. */
  proveedores?: (ctx: ContextoDeModulo) => Proveedores;
}

/** Ayuda de tipos para declarar un módulo. */
export function definirModulo(definicion: DefinicionDeModulo): DefinicionDeModulo {
  return definicion;
}
