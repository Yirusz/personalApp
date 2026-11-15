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
 * - Se comunica con los demás únicamente a través de eventos.
 */
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

export interface ContextoDeModulo {
  readonly moduloId: string;
  readonly almacen: AlmacenDeModulo;
  readonly reloj: Reloj;
  /** Nuevo UUIDv7 para identificar entidades. */
  nuevoId(): string;
  readonly t: Traductor;
  readonly formatos: Formatos;
  readonly diagnostico: Diagnostico;
  navegar(ruta: string): void;
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
}

/** Ayuda de tipos para declarar un módulo. */
export function definirModulo(definicion: DefinicionDeModulo): DefinicionDeModulo {
  return definicion;
}
