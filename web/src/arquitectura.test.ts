/**
 * Pruebas de arquitectura (sin dependencias extra): revisan las importaciones
 * del código fuente para que las reglas de capas y de módulos no se erosionen.
 * - Un módulo no importa código de otro módulo (solo del núcleo y la UI base).
 * - El dominio no importa UI, infraestructura, aplicación ni Preact.
 * - El núcleo no importa ningún módulo concreto (salvo el descubrimiento en modulos/index.ts).
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SRC = dirname(fileURLToPath(import.meta.url));

function archivos(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const ruta = join(dir, n);
    if (statSync(ruta).isDirectory()) return archivos(ruta);
    return /\.(ts|tsx)$/.test(n) && !/\.test\.ts$/.test(n) ? [ruta] : [];
  });
}

/** Ruta relativa a src/ con "/" (igual en Windows y Linux). */
const rel = (ruta: string) => relative(SRC, ruta).split(sep).join('/');

function importaciones(archivo: string): { especificador: string; destino: string | null }[] {
  const codigo = readFileSync(archivo, 'utf8');
  const patron = /(?:import|export)\s[^'"]*?from\s+['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g;
  const salida: { especificador: string; destino: string | null }[] = [];
  for (const m of codigo.matchAll(patron)) {
    const especificador = (m[1] ?? m[2])!;
    salida.push({ especificador, destino: especificador.startsWith('.') ? rel(resolve(dirname(archivo), especificador)) : null });
  }
  return salida;
}

const todos = archivos(SRC).map((a) => ({ ruta: rel(a), imports: importaciones(a) }));

describe('arquitectura', () => {
  it('se analizan archivos (sanidad de la prueba)', () => {
    expect(todos.length).toBeGreaterThan(20);
  });

  it('ningún módulo importa código de otro módulo', () => {
    const violaciones = todos.flatMap(({ ruta, imports }) => {
      const propio = /^modulos\/([^/]+)\//.exec(ruta)?.[1];
      if (!propio) return [];
      return imports
        .filter((i) => i.destino?.startsWith('modulos/') && !i.destino.startsWith(`modulos/${propio}/`))
        .map((i) => `${ruta} → ${i.especificador}`);
    });
    expect(violaciones).toEqual([]);
  });

  it('el dominio es puro: no importa UI, infraestructura, aplicación ni Preact', () => {
    const violaciones = todos
      .filter(({ ruta }) => /(^|\/)dominio\//.test(ruta))
      .flatMap(({ ruta, imports }) =>
        imports
          .filter(
            (i) =>
              i.especificador.startsWith('preact') ||
              /(^|\/)(ui|infraestructura|aplicacion)(\/|$)/.test(i.destino ?? '') ||
              (i.destino !== null && !/(^|\/)dominio\//.test(i.destino) && !i.destino.endsWith('.json')),
          )
          .map((i) => `${ruta} → ${i.especificador}`),
      );
    expect(violaciones).toEqual([]);
  });

  it('el núcleo y la UI base no dependen de módulos concretos', () => {
    const violaciones = todos
      .filter(({ ruta }) => /^(nucleo|ui)\//.test(ruta))
      .flatMap(({ ruta, imports }) =>
        imports.filter((i) => i.destino?.startsWith('modulos/')).map((i) => `${ruta} → ${i.especificador}`),
      );
    expect(violaciones).toEqual([]);
  });
});
