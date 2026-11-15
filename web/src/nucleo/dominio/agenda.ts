/**
 * Lenguaje publicado `ElementoDeAgenda` (docs/dominio.md §1).
 *
 * Cualquier módulo puede incluir `agenda` en los datos de sus eventos; el
 * Calendario lo proyecta sin conocer al módulo de origen (OCP). Por eso este
 * tipo vive en el núcleo (Shared Kernel) y debe mantenerse mínimo y estable:
 * solo se agregan campos opcionales.
 */

export type TipoDeElementoDeAgenda = 'vencimiento' | 'evento' | 'bloque';
export type EstadoDeElementoDeAgenda = 'pendiente' | 'hecho' | 'eliminado';

/** Colores categóricos disponibles como tokens (`--color-cat-<nombre>` en tokens.css). */
export const COLORES_CATEGORICOS = ['verde', 'azul', 'morado', 'rosa', 'rojo', 'naranja', 'amarillo', 'gris'] as const;
export type ColorCategorico = (typeof COLORES_CATEGORICOS)[number];

export function esColorCategorico(valor: unknown): valor is ColorCategorico {
  return typeof valor === 'string' && (COLORES_CATEGORICOS as readonly string[]).includes(valor);
}

export interface ElementoDeAgenda {
  /** Id estable del elemento en su módulo de origen. */
  id: string;
  titulo: string;
  /** Instante UTC ISO 8601. */
  inicio: string;
  /** Instante UTC ISO 8601; ausente = puntual (vencimiento). */
  fin?: string;
  todoElDia?: boolean;
  tipo: TipoDeElementoDeAgenda;
  estado: EstadoDeElementoDeAgenda;
  /** Token de color (no hex). */
  color?: ColorCategorico;
  /** Ruta interna para abrir el elemento en su módulo (p. ej. `/universidad/trabajos/<id>`). */
  ruta?: string;
}
