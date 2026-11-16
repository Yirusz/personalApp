/**
 * Color de los elementos de agenda (ADR-0015): un token de la paleta o un `#rrggbb` libre.
 *
 * Un hex libre no puede garantizar contraste en ambos esquemas, así que se calculan dos
 * variantes legibles (clara y oscura): se mezcla con negro o blanco en pasos del 5 % hasta
 * llegar a 3:1 contra el fondo y la superficie (WCAG 1.4.11, marcas gráficas). El texto
 * nunca se pinta con este color: va sobre un tinte suave con el color de texto del tema.
 */
import { esColorCategorico, type ColorCategorico } from './agenda';

export type ColorHex = `#${string}`;
export type ColorDeAgenda = ColorCategorico | ColorHex;

const PATRON_HEX = /^#[0-9a-f]{6}$/i;

export function esColorHex(valor: unknown): valor is ColorHex {
  return typeof valor === 'string' && PATRON_HEX.test(valor);
}

export function esColorDeAgenda(valor: unknown): valor is ColorDeAgenda {
  return esColorCategorico(valor) || esColorHex(valor);
}

export class ColorInvalido extends Error {
  override readonly name = 'ColorInvalido';
}

/** Valida y normaliza (hex en minúsculas). */
export function colorDeAgenda(valor: string): ColorDeAgenda {
  const v = valor.trim();
  if (esColorCategorico(v)) return v;
  if (esColorHex(v)) return v.toLowerCase() as ColorHex;
  throw new ColorInvalido(`Color inválido: ${valor}`);
}

/** Fondo y superficie de cada esquema (deben coincidir con tokens.css). */
export const SUPERFICIES = { claro: ['#ffffff', '#f6f8f7'], oscuro: ['#1a211e', '#111614'] } as const;
export const CONTRASTE_MINIMO = 3;

type Rgb = [number, number, number];

const aRgb = (hex: string): Rgb => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as Rgb;
const aHex = (rgb: Rgb) => `#${rgb.map((c) => Math.round(c).toString(16).padStart(2, '0')).join('')}` as ColorHex;

function luminancia(hex: string): number {
  const [r, g, b] = aRgb(hex).map((c) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  }) as Rgb;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Razón de contraste WCAG 2 (1–21). */
export function contraste(a: string, b: string): number {
  const [x, y] = [luminancia(a), luminancia(b)].sort((m, n) => n - m) as [number, number];
  return (x + 0.05) / (y + 0.05);
}

function ajustar(hex: string, hacia: Rgb, fondos: readonly string[]): ColorHex {
  const base = aRgb(hex);
  for (let paso = 0; paso <= 20; paso++) {
    const t = paso / 20;
    const c = aHex(base.map((v, i) => v + (hacia[i]! - v) * t) as Rgb);
    if (fondos.every((f) => contraste(c, f) >= CONTRASTE_MINIMO)) return c;
  }
  return aHex(hacia);
}

/** Variantes del hex que se leen como marca en tema claro y oscuro. */
export function variantesLegibles(hex: string): { claro: ColorHex; oscuro: ColorHex } {
  const h = hex.toLowerCase();
  return { claro: ajustar(h, [0, 0, 0], SUPERFICIES.claro), oscuro: ajustar(h, [255, 255, 255], SUPERFICIES.oscuro) };
}

// ---------------------------------------------------------------------------
// Barras rellenas (mes, día, semana): texto legible sobre el color (≥ 4,5:1)
// ---------------------------------------------------------------------------

export const TEXTO_CLARO = '#ffffff';
export const TEXTO_OSCURO = '#111614';
const CONTRASTE_TEXTO = 4.5;

/** Texto claro u oscuro, el que más contraste tenga con el fondo. */
export function textoSobre(fondo: string): typeof TEXTO_CLARO | typeof TEXTO_OSCURO {
  return contraste(TEXTO_CLARO, fondo) >= contraste(TEXTO_OSCURO, fondo) ? TEXTO_CLARO : TEXTO_OSCURO;
}

/** Fondo y texto para una barra rellena: si ninguno de los dos textos llega a 4,5:1, se oscurece el fondo. */
export function rellenoLegible(hex: string): { fondo: ColorHex; texto: string } {
  const base = aRgb(hex.toLowerCase());
  for (let paso = 0; paso <= 20; paso++) {
    const fondo = aHex(base.map((v) => v * (1 - paso / 20)) as Rgb);
    const texto = textoSobre(fondo);
    if (contraste(texto, fondo) >= CONTRASTE_TEXTO) return { fondo, texto };
  }
  return { fondo: '#000000', texto: TEXTO_CLARO };
}

// ---------------------------------------------------------------------------
// HSV (selector de color integrado)
// ---------------------------------------------------------------------------

/** Tono 0–359, saturación y brillo 0–100 (enteros). */
export interface Hsv {
  h: number;
  s: number;
  v: number;
}

const acotar = (x: number, min: number, max: number) => Math.min(max, Math.max(min, x));

export function hexDesdeHsv({ h, s, v }: Hsv): ColorHex {
  const hh = (((h % 360) + 360) % 360) / 60;
  const ss = acotar(s, 0, 100) / 100;
  const vv = acotar(v, 0, 100) / 100;
  const c = vv * ss;
  const x = c * (1 - Math.abs((hh % 2) - 1));
  const [r, g, b] = hh < 1 ? [c, x, 0] : hh < 2 ? [x, c, 0] : hh < 3 ? [0, c, x] : hh < 4 ? [0, x, c] : hh < 5 ? [x, 0, c] : [c, 0, x];
  const m = vv - c;
  return aHex([(r + m) * 255, (g + m) * 255, (b + m) * 255]);
}

export function hsvDesdeHex(hex: string): Hsv {
  const [r, g, b] = aRgb(hex.toLowerCase()).map((c) => c / 255) as Rgb;
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  let h = 0;
  if (d > 0) {
    if (max === r) h = 60 * (((g - b) / d) % 6);
    else if (max === g) h = 60 * ((b - r) / d + 2);
    else h = 60 * ((r - g) / d + 4);
  }
  return { h: Math.round((h + 360) % 360) % 360, s: max === 0 ? 0 : Math.round((d / max) * 100), v: Math.round(max * 100) };
}
